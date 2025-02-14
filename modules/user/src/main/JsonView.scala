package lidraughts.user

import lidraughts.rating.{ Perf, PerfType }
import play.api.libs.json._
import User.{ PlayTime, LightPerf }

final class JsonView(isOnline: User.ID => Boolean) {

  import JsonView._
  private implicit val profileWrites = Json.writes[Profile]
  private implicit val playTimeWrites = Json.writes[PlayTime]

  def apply(u: User, onlyPerf: Option[PerfType] = None): JsObject = Json.obj(
    "id" -> u.id,
    "username" -> u.username,
    "online" -> isOnline(u.id),
    "perfs" -> perfs(u, onlyPerf),
    "createdAt" -> u.createdAt
  ).add("disabled" -> u.disabled)
    .add("engine" -> u.engine)
    .add("booster" -> u.booster)
    .add("profile" -> u.profile.map(p => profileWrites.writes(p).noNull))
    .add("seenAt" -> u.seenAt)
    .add("patron" -> u.isPatron)
    .add("playTime" -> u.playTime)
    .add("language" -> u.lang)
    .add("title" -> u.title)

  def minimal(u: User, onlyPerf: Option[PerfType]) = Json.obj(
    "id" -> u.id,
    "username" -> u.username,
    "online" -> isOnline(u.id),
    "perfs" -> perfs(u, onlyPerf)
  ).add("title" -> u.title)
    .add("disabled" -> u.disabled)
    .add("engine" -> u.engine)
    .add("booster" -> u.booster)
    .add("language" -> u.lang)
    .add("profile" -> u.profile.flatMap(_.country).map { country =>
      Json.obj("country" -> country)
    })
    .add("patron" -> u.isPatron)

  def lightPerfIsOnline(lp: LightPerf) =
    lightPerfWrites.writes(lp).add("online", isOnline(lp.user.id))
}

object JsonView {

  import Title.titleJsonWrites

  implicit val nameWrites = Writes[User] { u =>
    JsString(u.username)
  }

  implicit val lightPerfWrites = OWrites[LightPerf] { l =>
    Json.obj(
      "id" -> l.user.id,
      "username" -> l.user.name,
      "perfs" -> Json.obj(
        l.perfKey -> Json.obj("rating" -> l.rating, "progress" -> l.progress)
      )
    ).add("title" -> l.user.title)
      .add("patron" -> l.user.isPatron)
  }

  implicit val modWrites = OWrites[User] { u =>
    Json.obj(
      "id" -> u.id,
      "username" -> u.username,
      "title" -> u.title,
      "engine" -> u.engine,
      "booster" -> u.booster,
      "troll" -> u.troll,
      "games" -> u.count.game
    ).add("title" -> u.title)
  }

  implicit val perfWrites: OWrites[Perf] = OWrites { o =>
    Json.obj(
      "games" -> o.nb,
      "rating" -> o.glicko.rating.toInt,
      "rd" -> o.glicko.deviation.toInt,
      "prog" -> o.progress
    ).add("prov" -> o.glicko.provisional)
  }

  private val standardPerfKeys: Set[Perf.Key] = PerfType.standard.map(_.key)(scala.collection.breakOut)

  private def select(key: String, perf: Perf) =
    perf.nb > 0 || standardPerfKeys(key)

  def perfs(u: User, onlyPerf: Option[PerfType] = None) =
    JsObject(u.perfs.perfsMap collect {
      case (key, perf) if onlyPerf.fold(select(key, perf))(_.key == key) =>
        key -> perfWrites.writes(perf)
    })

  def perfs(u: User, onlyPerfs: List[PerfType]) =
    JsObject(onlyPerfs.map { perfType =>
      perfType.key -> perfWrites.writes(u.perfs(perfType))
    })
}
