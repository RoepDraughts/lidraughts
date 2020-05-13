package lidraughts.swiss

import com.github.blemale.scaffeine.Scaffeine
import scala.concurrent.duration._

import lidraughts.common.LightUser
import lidraughts.game.Game

private case class SwissBoard(
    gameId: Game.ID,
    white: SwissBoard.Player,
    black: SwissBoard.Player
)

private object SwissBoard {
  case class Player(user: LightUser, rank: Int, rating: Int)
  case class WithGame(board: SwissBoard, game: Game)
}

final private class SwissBoardApi(
    rankingApi: SwissRankingApi,
    asyncCache: lidraughts.memo.AsyncCache.Builder,
    lightUserApi: lidraughts.user.LightUserApi,
    proxyGame: Game.ID => Fu[Option[Game]]
) {

  private val displayBoards = 6

  private val boardsCache = Scaffeine()
    .expireAfterWrite(60 minutes)
    .build[Swiss.Id, List[SwissBoard]]

  def apply(id: Swiss.Id): List[SwissBoard] = ~(boardsCache getIfPresent id)

  def withGames(id: Swiss.Id): Fu[List[SwissBoard.WithGame]] =
    apply(id)
      .map { board =>
        proxyGame(board.gameId) map2 { g: Game =>
          SwissBoard.WithGame(board, g)
        }
      }
      .sequenceFu
      .dmap(_.flatten)

  def update(data: SwissScoring.Result): Funit =
    data match {
      case SwissScoring.Result(swiss, leaderboard, playerMap, pairings) =>
        rankingApi(swiss) map { ranks =>
          boardsCache
            .put(
              swiss.id,
              leaderboard
                .collect {
                  case (player, _) if player.present => player
                }
                .flatMap { player =>
                  pairings get player.number flatMap {
                    _ get swiss.round
                  }
                }
                .filter(_.isOngoing)
                .distinct
                .take(displayBoards)
                .flatMap { pairing =>
                  for {
                    p1 <- playerMap get pairing.white
                    p2 <- playerMap get pairing.black
                    u1 <- lightUserApi sync p1.userId
                    u2 <- lightUserApi sync p2.userId
                    r1 <- ranks get p1.number
                    r2 <- ranks get p2.number
                  } yield SwissBoard(
                    pairing.gameId,
                    white = SwissBoard.Player(u1, r1 + 1, p1.rating),
                    black = SwissBoard.Player(u2, r2 + 1, p2.rating)
                  )
                }
            )
        }
    }
}
