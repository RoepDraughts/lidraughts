package lidraughts.mod

import draughts.{ Color, variant }
import lidraughts.db.dsl._
import lidraughts.game.Game
import lidraughts.user.User

import reactivemongo.bson._

final class BoostingApi(
    modApi: ModApi,
    collBoosting: Coll,
    nbGamesToMark: Int,
    ratioGamesToMark: Double
) {
  import BoostingApi._

  private implicit val boostingRecordBSONHandler = Macros.handler[BoostingRecord]

  private val variants = Set[variant.Variant](
    variant.Standard,
    variant.Frisian,
    variant.Frysk,
    variant.Antidraughts,
    variant.Breakthrough,
    variant.Russian,
    variant.Brazilian
  )

  def getBoostingRecord(id: String): Fu[Option[BoostingRecord]] =
    collBoosting.byId[BoostingRecord](id)

  def createBoostRecord(record: BoostingRecord) =
    collBoosting.update($id(record.id), record, upsert = true).void

  def determineBoosting(record: BoostingRecord, winner: User, loser: User): Funit =
    (record.games >= nbGamesToMark) ?? {
      {
        (record.games >= (winner.count.rated * ratioGamesToMark)) ?? modApi.autoBooster(winner.id, loser.id)
      } >> {
        (record.games >= (loser.count.rated * ratioGamesToMark)) ?? modApi.autoBooster(winner.id, loser.id)
      }
    }

  def boostingId(winner: User, loser: User): String = winner.id + "/" + loser.id

  def check(game: Game, whiteUser: User, blackUser: User): Funit = {
    if (game.rated
      && game.accountable
      && game.playedTurns <= 10
      && !game.isTournament
      && game.winnerColor.isDefined
      && variants.contains(game.variant)
      && !game.isCorrespondence
      && game.clock.fold(false) { _.limitInMinutes >= 1 }) {
      game.winnerColor match {
        case Some(a) => {
          val result: GameResult = a match {
            case Color.White => GameResult(winner = whiteUser, loser = blackUser)
            case Color.Black => GameResult(winner = blackUser, loser = whiteUser)
          }
          val id = boostingId(result.winner, result.loser)
          getBoostingRecord(id).flatMap {
            case Some(record) =>
              val newRecord = BoostingRecord(
                _id = id,
                games = record.games + 1
              )
              createBoostRecord(newRecord) >> determineBoosting(newRecord, result.winner, result.loser)
            case none => createBoostRecord(BoostingRecord(
              _id = id,
              games = 1
            ))
          }
        }
        case none => funit
      }
    } else {
      funit
    }
  }

}

object BoostingApi {

  case class BoostingRecord(_id: String, games: Int) {
    def id = _id
  }

  case class GameResult(
      winner: User,
      loser: User
  )
}
