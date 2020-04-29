package views.html
package swiss

import play.api.libs.json.Json

import lidraughts.api.Context
import lidraughts.app.templating.Environment._
import lidraughts.app.ui.ScalatagsTemplate._
import lidraughts.common.String.html.safeJsonValue
import lidraughts.swiss.Swiss

import controllers.routes

object show {

  def apply(
    swiss: Swiss,
    data: play.api.libs.json.JsObject,
    chatOption: Option[lidraughts.chat.UserChat.Mine]
  )(implicit ctx: Context): Frag = ???
  // views.html.base.layout(
  //   title = s"${tour.name()} #${tour.id}",
  //   moreJs = frag(
  //     jsAt(s"compiled/lichess.tournament${isProd ?? (".min")}.js"),
  //     embedJsUnsafe(s"""lichess=lichess||{};lichess.tournament=${safeJsonValue(
  //       Json.obj(
  //         "data"   -> data,
  //         "i18n"   -> bits.jsI18n,
  //         "userId" -> ctx.userId,
  //         "chat" -> chatOption.map { c =>
  //           chat.json(
  //             c.chat,
  //             name = trans.chatRoom.txt(),
  //             timeout = c.timeout,
  //             public = true,
  //             resourceId = lila.chat.Chat.ResourceId(s"tournament/${c.chat.id}")
  //           )
  //         }
  //       )
  //     )}""")
  //   ),
  //   moreCss = cssTag {
  //     if (tour.isTeamBattle) "tournament.show.team-battle"
  //     else "tournament.show"
  //   },
  //   chessground = false,
  //   openGraph = lila.app.ui
  //     .OpenGraph(
  //       title = s"${tour.name()}: ${tour.variant.name} ${tour.clock.show} ${tour.mode.name} #${tour.id}",
  //       url = s"$netBaseUrl${routes.Tournament.show(tour.id).url}",
  //       description = s"${tour.nbPlayers} players compete in the ${showEnglishDate(tour.startsAt)} ${tour.name()}. " +
  //         s"${tour.clock.show} ${tour.mode.name} games are played during ${tour.minutes} minutes. " +
  //         tour.winnerId.fold("Winner is not yet decided.") { winnerId =>
  //           s"${usernameOrId(winnerId)} takes the prize home!"
  //         }
  //     )
  //     .some
  // )(
  //   main(cls := s"tour${tour.schedule
  //     .?? { sched =>
  //       s" tour-sched tour-sched-${sched.freq.name} tour-speed-${sched.speed.name} tour-variant-${sched.variant.key} tour-id-${tour.id}"
  //     }}")(
  //     st.aside(cls := "tour__side")(
  //       tournament.side(tour, verdicts, streamers, shieldOwner, chatOption.isDefined)
  //     ),
  //     div(cls := "tour__main")(div(cls := "box")),
  //     tour.isCreated option div(cls := "tour__faq")(
  //       faq(tour.mode.rated.some, tour.isPrivate.option(tour.id))
  //     )
  //   )
  // )
}
