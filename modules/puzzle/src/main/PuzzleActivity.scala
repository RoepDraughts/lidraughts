package lidraughts.puzzle

import org.joda.time.DateTime
import play.api.libs.iteratee._
import play.api.libs.json._
import reactivemongo.api.ReadPreference
import reactivemongo.play.iteratees.cursorProducer
import scala.concurrent.duration._

import lidraughts.common.MaxPerSecond
import lidraughts.db.dsl._
import lidraughts.user.User

final class PuzzleActivity(
    puzzleColl: Coll,
    roundColl: Coll
)(implicit system: akka.actor.ActorSystem) {

  import PuzzleActivity._
  import Round.RoundBSONHandler

  def stream(config: Config): Enumerator[String] = {

    val selector = $doc("_id" $startsWith config.user.id)

    val query = roundColl.find(selector).sort($sort desc "_id")

    val infinite = query.copy(options = query.options.batchSize(config.perSecond.value))
      .cursor[Round](ReadPreference.secondaryPreferred)
      .bulkEnumerator() &>
      Enumeratee.mapM[Iterator[Round]].apply[Seq[JsObject]] { rounds =>
        enrich(rounds.toSeq)
      } &>
      lidraughts.common.Iteratee.delay(1 second) &>
      Enumeratee.mapConcat(_.toSeq)

    val stream = config.max.fold(infinite) { max =>
      // I couldn't figure out how to do it properly :( :( :(
      // the nb can't be set as bulkEnumerator(nb)
      // because games are further filtered after being fetched
      var nb = 0
      infinite &> Enumeratee.mapInput { in =>
        nb = nb + 1
        if (nb <= max) in
        else Input.EOF
      }
    }

    stream &> formatter
  }

  private def enrich(rounds: Seq[Round]): Fu[Seq[JsObject]] =
    puzzleColl.primitiveMap[Int, Double](
      ids = rounds.map(_.puzzleId).toSeq,
      field = "perf.gl.r",
      fieldExtractor = obj => for {
        perf <- obj.getAs[Bdoc]("perf")
        gl <- perf.getAs[Bdoc]("gl")
        rating <- gl.getAs[Double]("r")
      } yield rating
    ) map { ratings =>
        rounds.toSeq flatMap { round =>
          ratings get round.puzzleId map { puzzleRating =>
            Json.obj(
              "id" -> round.puzzleId,
              "date" -> round.date,
              "rating" -> round.rating,
              "ratingDiff" -> round.ratingDiff,
              "puzzleRating" -> puzzleRating.toInt
            )
          }
        }
      }

  private def formatter =
    Enumeratee.map[JsObject].apply[String] { json =>
      s"${Json.stringify(json)}\n"
    }
}

object PuzzleActivity {

  case class Config(
      user: User,
      max: Option[Int] = None,
      perSecond: MaxPerSecond
  )
}
