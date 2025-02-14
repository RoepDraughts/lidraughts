package views.html

import play.api.libs.json.Json

import lidraughts.api.Context
import lidraughts.app.templating.Environment._
import lidraughts.app.ui.ScalatagsTemplate._
import lidraughts.common.String.html.safeJsonValue
import lidraughts.pref.Pref.Color

import controllers.routes

object coordinate {

  def home(scoreOption: Option[lidraughts.coordinate.Score])(implicit ctx: Context) =
    views.html.base.layout(
      title = trans.coordinates.coordinateTraining.txt(),
      moreCss = cssTag("coordinate"),
      moreJs = frag(
        jsTag("vendor/sparkline.min.js"),
        jsAt("compiled/coordinate.js")
      ),
      openGraph = lidraughts.app.ui.OpenGraph(
        title = "Draughts board coordinates trainer",
        url = s"$netBaseUrl${routes.Coordinate.home.url}",
        description = "Knowing the board coordinates is a very important draughts skill. A square number appears on the board and you must click on the correct square."
      ).some,
      zoomable = true
    )(
        main(
          id := "trainer",
          cls := "coord-trainer training init",
          attr("data-color-pref") := ctx.pref.coordColorName,
          attr("data-score-url") := ctx.isAuth.option(routes.Coordinate.score().url)
        )(
            div(cls := "coord-trainer__side")(
              div(cls := "box")(
                h1(trans.coordinates.coordinates()),
                if (ctx.isAuth) scoreOption.map { score =>
                  div(cls := "scores")(scoreCharts(score))
                }
                else div(cls := "register")(
                  p(trans.toTrackYourProgress()),
                  p(cls := "signup")(
                    a(cls := "button", href := routes.Auth.signup)(trans.signUp())
                  )
                )
              ),
              form(cls := "color buttons", action := routes.Coordinate.color)(
                st.group(cls := "radio")(
                  List(Color.BLACK, Color.RANDOM, Color.WHITE).map { id =>
                    div(
                      input(
                        tpe := "radio",
                        st.id := s"coord_color_$id",
                        name := "color",
                        value := id,
                        (id == ctx.pref.coordColor) option checked
                      ),
                      label(`for` := s"coord_color_$id", cls := s"color color_$id")(i)
                    )
                  }
                )
              )
            ),
            div(cls := "coord-trainer__board main-board is100")(
              div(cls := "next_coord", id := "next_coord0"),
              div(cls := "next_coord", id := "next_coord1"),
              div(cls := "next_coord", id := "next_coord2"),
              draughtsgroundBoard
            ),
            div(cls := "coord-trainer__table")(
              div(cls := "explanation")(
                p(trans.coordinates.knowingTheDraughtsBoard()),
                ul(
                  li(trans.coordinates.mostDraughtsCourses()),
                  li(trans.coordinates.talkToYourDraughtsFriends()),
                  li(trans.coordinates.youCanAnalyseAGameMoreEffectively())
                ),
                p(trans.coordinates.aSquareNameAppears())
              ),
              button(cls := "start button button-fat")(trans.coordinates.startTraining())
            ),
            div(cls := "coord-trainer__score")(0),
            div(cls := "coord-trainer__progress")(div(cls := "progress_bar"))
          )
      )

  def scoreCharts(score: lidraughts.coordinate.Score)(implicit ctx: Context) = frag(
    List((trans.coordinates.averageScoreAsWhiteX, score.white), (trans.coordinates.averageScoreAsBlackX, score.black)).map {
      case (averageScoreX, s) => div(cls := "chart_container")(
        s.nonEmpty option frag(
          p(averageScoreX(raw(s"""<strong>${"%.2f".format(s.sum.toDouble / s.size)}</strong>"""))),
          div(cls := "user_chart", attr("data-points") := safeJsonValue(Json toJson s))
        )
      )
    }
  )
}
