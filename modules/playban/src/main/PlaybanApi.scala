package lidraughts.playban

import reactivemongo.bson._
import scala.concurrent.duration._

import draughts.{ Status, Color }
import lidraughts.common.Iso
import lidraughts.common.PlayApp.{ startedSinceMinutes, isDev }
import lidraughts.db.dsl._
import lidraughts.game.{ Pov, Game, Player, Source }
import lidraughts.message.{ MessageApi, ModPreset }
import lidraughts.user.{ User, UserRepo }
import lidraughts.common.Iso

import org.joda.time.DateTime

final class PlaybanApi(
    coll: Coll,
    sandbag: SandbagWatch,
    feedback: PlaybanFeedback,
    bus: lidraughts.common.Bus,
    asyncCache: lidraughts.memo.AsyncCache.Builder,
    messenger: MessageApi
) {

  import lidraughts.db.BSON.BSONJodaDateTimeHandler
  import reactivemongo.bson.Macros
  private implicit val OutcomeBSONHandler = new BSONHandler[BSONInteger, Outcome] {
    def read(bsonInt: BSONInteger): Outcome = Outcome(bsonInt.value) err s"No such playban outcome: ${bsonInt.value}"
    def write(x: Outcome) = BSONInteger(x.id)
  }
  private implicit val RageSitBSONHandler = intIsoHandler(Iso.int[RageSit](RageSit.apply, _.counter))
  private implicit val BanBSONHandler = Macros.handler[TempBan]
  private implicit val UserRecordBSONHandler = Macros.handler[UserRecord]

  private case class Blame(player: Player, outcome: Outcome)

  private val blameableSources: Set[Source] = Set(Source.Lobby, Source.Pool, Source.Tournament)

  private def blameable(game: Game): Fu[Boolean] =
    (game.source.exists(s => blameableSources(s)) && game.hasClock) ?? {
      if (game.rated) fuTrue
      else UserRepo.containsEngine(game.userIds) map (!_)
    }

  private def IfBlameable[A: ornicar.scalalib.Zero](game: Game)(f: => Fu[A]): Fu[A] =
    (isDev || startedSinceMinutes(10)) ?? {
      blameable(game) flatMap { _ ?? f }
    }

  private def roughWinEstimate(game: Game, color: Color) = {
    (game.draughts.board.materialImbalance, game.variant) match {
      case (_, draughts.variant.Antidraughts) => 0
      case (a, _) if a >= 5 => 1
      case (a, _) if a <= -5 => -1
      case _ => 0
    }
  } * (if (color.white) 1 else -1)

  def abort(pov: Pov, isOnGame: Set[Color]): Funit = IfBlameable(pov.game) {
    pov.player.userId.ifTrue(isOnGame(pov.opponent.color)) ?? { userId =>
      save(Outcome.Abort, userId, 0) >>- feedback.abort(pov)
    }
  }

  def noStart(pov: Pov): Funit = IfBlameable(pov.game) {
    pov.player.userId ?? { userId =>
      save(Outcome.NoPlay, userId, 0) >>- feedback.noStart(pov)
    }
  }

  def rageQuit(game: Game, quitterColor: Color): Funit =
    sandbag(game, quitterColor) >> IfBlameable(game) {
      game.player(quitterColor).userId ?? { userId =>
        save(Outcome.RageQuit, userId, roughWinEstimate(game, quitterColor) * 10) >>-
          feedback.rageQuit(Pov(game, quitterColor))
      }
    }

  def flag(game: Game, flaggerColor: Color): Funit = {

    def unreasonableTime = game.clock map { c =>
      (c.estimateTotalSeconds / 12) atLeast 15 atMost (3 * 60)
    }

    // flagged after waiting a long time
    def sitting = for {
      userId <- game.player(flaggerColor).userId
      seconds = nowSeconds - game.movedAt.getSeconds
      limit <- unreasonableTime
      if seconds >= limit
    } yield save(Outcome.Sitting, userId, roughWinEstimate(game, flaggerColor) * 10) >>-
      feedback.sitting(Pov(game, flaggerColor)) >>-
      propagateSitting(game, userId)

    // flagged after waiting a short time;
    // but the previous move used a long time.
    // assumes game was already checked for sitting
    def sitMoving = for {
      userId <- game.player(flaggerColor).userId
      movetimes <- game moveTimes flaggerColor
      lastMovetime <- movetimes.lastOption
      limit <- unreasonableTime
      if lastMovetime.toSeconds >= limit
    } yield save(Outcome.SitMoving, userId, roughWinEstimate(game, flaggerColor) * 10) >>-
      feedback.sitting(Pov(game, flaggerColor)) >>-
      propagateSitting(game, userId)

    sandbag(game, flaggerColor) flatMap { isSandbag =>
      IfBlameable(game) {
        sitting orElse
          sitMoving getOrElse
          goodOrSandbag(game, flaggerColor, isSandbag)
      }
    }
  }

  private def propagateSitting(game: Game, userId: User.ID): Funit =
    rageSitCache get userId map { rageSit =>
      if (rageSit.isBad) bus.publish(SittingDetected(game, userId), 'playban)
    }

  def other(game: Game, status: Status.type => Status, winner: Option[Color]): Funit =
    winner.?? { w => sandbag(game, !w) } flatMap { isSandbag =>
      IfBlameable(game) {
        ~(for {
          w <- winner
          loserId <- game.player(!w).userId
        } yield {
          if (Status.NoStart is status) save(Outcome.NoPlay, loserId, 0) >>- feedback.noStart(Pov(game, !w))
          else goodOrSandbag(game, !w, isSandbag)
        })
      }
    }

  private def goodOrSandbag(game: Game, loserColor: Color, isSandbag: Boolean): Funit =
    game.player(loserColor).userId ?? { userId =>
      if (isSandbag) feedback.sandbag(Pov(game, loserColor))
      val rageSitDelta = if (isSandbag) 0 else 1 // proper defeat decays ragesit
      save(if (isSandbag) Outcome.Sandbag else Outcome.Good, userId, rageSitDelta)
    }

  // memorize users without any ban to save DB reads
  private val cleanUserIds = new lidraughts.memo.ExpireSetMemo(30 minutes)

  def currentBan(userId: User.ID): Fu[Option[TempBan]] = !cleanUserIds.get(userId) ?? {
    coll.find(
      $doc("_id" -> userId, "b.0" $exists true),
      $doc("_id" -> false, "b" -> $doc("$slice" -> -1))
    ).uno[Bdoc].map {
        _.flatMap(_.getAs[List[TempBan]]("b")).??(_.find(_.inEffect))
      } addEffect { ban =>
        if (ban.isEmpty) cleanUserIds put userId
      }
  }

  def hasCurrentBan(userId: User.ID): Fu[Boolean] = currentBan(userId).map(_.isDefined)

  def completionRate(userId: User.ID): Fu[Option[Double]] =
    coll.primitiveOne[List[Outcome]]($id(userId), "o").map(~_) map { outcomes =>
      outcomes.collect {
        case Outcome.RageQuit | Outcome.Sitting | Outcome.NoPlay | Outcome.Abort => false
        case Outcome.Good => true
      } match {
        case c if c.size >= 5 => Some(c.count(identity).toDouble / c.size)
        case _ => none
      }
    }

  def bans(userIds: List[User.ID]): Fu[Map[User.ID, Int]] = coll.find(
    $inIds(userIds),
    $doc("b" -> true)
  ).list[Bdoc]().map {
      _.flatMap { obj =>
        obj.getAs[User.ID]("_id") flatMap { id =>
          obj.getAs[Barr]("b") map { id -> _.stream.size }
        }
      }(scala.collection.breakOut)
    }

  def getRageSit(userId: User.ID) = rageSitCache get userId

  private val rageSitCache = asyncCache.multi[User.ID, RageSit](
    name = "playban.ragesit",
    f = userId => coll.primitiveOne[RageSit]($doc("_id" -> userId, "c" $exists true), "c").map(_ | RageSit.empty),
    expireAfter = _.ExpireAfterWrite(30 minutes)
  )

  private def save(outcome: Outcome, userId: User.ID, rageSitDelta: Int): Funit = {
    lidraughts.mon.playban.outcome(outcome.key)()
    coll.findAndUpdate(
      selector = $id(userId),
      update = $doc(
        $push("o" -> $doc("$each" -> List(outcome), "$slice" -> -30)),
        if (rageSitDelta == 0) $min("c" -> 0)
        else $inc("c" -> rageSitDelta)
      ),
      fetchNewObject = true,
      upsert = true
    ).map(_.value) map2 UserRecordBSONHandler.read flatten
      s"can't find newly created record for user $userId" flatMap { record =>
        (outcome != Outcome.Good) ?? {
          UserRepo.createdAtById(userId).flatMap { _ ?? { legiferate(record, _) } }
        } >> {
          (rageSitDelta != 0) ?? registerRageSit(record, rageSitDelta)
        }
      }
  }.void logFailure lidraughts.log("playban")

  private def registerRageSit(record: UserRecord, delta: Int): Funit = {
    rageSitCache.put(record.userId, record.rageSit)
    (delta < 0) ?? {
      if (record.rageSit.isTerrible) {
        lidraughts.log("ragesit").warn(s"Close https://lidraughts.org/@/${record.userId} ragesit=${record.rageSit}")
        // bus.publish(lidraughts.hub.actorApi.playban.SitcounterClose(userId), 'playban)
        funit
      } else if (record.rageSit.isVeryBad) for {
        mod <- UserRepo.Lidraughts
        user <- UserRepo byId record.userId
      } yield (mod zip user).headOption foreach {
        case (m, u) =>
          lidraughts.log("ragesit").info(s"https://lidraughts.org/@/${u.username} ${record.rageSit.counterView}")
          bus.publish(lidraughts.hub.actorApi.mod.AutoWarning(u.id, ModPreset.sittingAuto.subject), 'autoWarning)
          messenger.sendPreset(m, u, ModPreset.sittingAuto).void
      }
      else funit
    }
  }

  private def legiferate(record: UserRecord, accCreatedAt: DateTime): Funit = record.bannable(accCreatedAt) ?? { ban =>
    (!record.banInEffect) ?? {
      lidraughts.mon.playban.ban.count()
      lidraughts.mon.playban.ban.mins(ban.mins)
      bus.publish(lidraughts.hub.actorApi.playban.Playban(record.userId, ban.mins), 'playban)
      coll.update(
        $id(record.userId),
        $unset("o") ++
          $push(
            "b" -> $doc(
              "$each" -> List(ban),
              "$slice" -> -30
            )
          )
      ).void >>- cleanUserIds.remove(record.userId)
    }
  }
}
