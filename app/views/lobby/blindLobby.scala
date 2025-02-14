package views.html.lobby

import lidraughts.api.Context
import lidraughts.app.templating.Environment._
import lidraughts.app.ui.ScalatagsTemplate._
import lidraughts.game.Pov

import controllers.routes

object blindLobby {

  def apply(games: List[Pov])(implicit ctx: Context) = div(
    h2(games.size, " ongoing games"),
    games.nonEmpty option ongoingGames(games),
    div(cls := "lobby__app")
  )

  private def ongoingGames(games: List[Pov])(implicit ctx: Context) = games.partition(_.isMyTurn) match {
    case (myTurn, opTurn) => frag(
      h3("My turn: ", myTurn.size, " games"),
      ul(myTurn map renderGame),
      h3("Opponent turn: ", opTurn.size, " games"),
      ul(opTurn map renderGame)
    )
  }

  private def renderGame(pov: Pov)(implicit ctx: Context) = li(
    a(href := gameLink(pov))(
      playerText(pov.opponent),
      " ",
      pov.isMyTurn ?? pov.remainingSeconds map { secondsFromNow(_, true) }
    )
  )
}
