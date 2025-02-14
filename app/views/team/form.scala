package views.html.team

import play.api.data.Form

import lidraughts.api.Context
import lidraughts.app.templating.Environment._
import lidraughts.app.ui.ScalatagsTemplate._

import controllers.routes

object form {

  import trans.team._

  def create(form: Form[_], captcha: lidraughts.common.Captcha)(implicit ctx: Context) =
    views.html.base.layout(
      title = newTeam.txt(),
      moreCss = cssTag("team"),
      moreJs = frag(infiniteScrollTag, captchaTag)
    ) {
        main(cls := "page-menu page-small")(
          bits.menu("form".some),
          div(cls := "page-menu__content box box-pad")(
            h1(newTeam()),
            postForm(cls := "form3", action := routes.Team.create())(
              form3.globalError(form),
              form3.group(form("name"), trans.name())(form3.input(_)),
              form3.group(form("open"), joiningPolicy()) { f =>
                form3.select(
                  form("open"),
                  Seq(0 -> aConfirmationIsRequiredToJoin.txt(), 1 -> anyoneCanJoin.txt())
                )
              },
              form3.group(form("location"), trans.location())(form3.input(_)),
              form3.group(form("description"), trans.description())(form3.textarea(_)(rows := 10)),
              views.html.base.captcha(form, captcha),
              form3.actions(
                a(href := routes.Team.home(1))(trans.cancel()),
                form3.submit(newTeam())
              )
            )
          )
        )
      }

  def edit(t: lidraughts.team.Team, form: Form[_])(implicit ctx: Context) = {
    val title = "Edit Team " + t.name
    bits.layout(title = title) {
      main(cls := "page-menu page-small")(
        bits.menu(none),
        div(cls := "page-menu__content box box-pad")(
          h1(title),
          postForm(cls := "form3", action := routes.Team.update(t.id))(
            div(cls := "form-group")(
              a(cls := "button button-empty", href := routes.Team.kick(t.id))(kickSomeone()),
              a(cls := "button button-empty", href := routes.Team.changeOwner(t.id))(appointOwner())
            ),
            form3.group(form("open"), joiningPolicy()) { f =>
              form3.select(
                f,
                Seq(0 -> aConfirmationIsRequiredToJoin.txt(), 1 -> anyoneCanJoin.txt())
              )
            },
            form3.group(form("location"), trans.location())(form3.input(_)),
            form3.group(form("description"), trans.description())(form3.textarea(_)(rows := 10)),
            form3.checkbox(form("chat"), enableMembersChat()),
            form3.actions(
              a(href := routes.Team.show(t.id), style := "margin-left:20px")(trans.cancel()),
              form3.submit(trans.apply())
            )
          ),
          isGranted(_.ManageTeam) option frag(
            hr,
            postForm(cls := "inline", action := routes.Team.close(t.id))(
              submitButton(
                dataIcon := "q",
                cls := "text button button-empty button-red confirm",
                st.title := deleteTeamWarning.txt()
              )(trans.delete())
            )
          )
        )
      )
    }
  }
}
