package lidraughts.swiss

import lidraughts.db.dsl._

final class SwissScoring(
    playerColl: Coll,
    pairingColl: Coll
) {

  import BsonHandlers._

  def recompute(swiss: Swiss): Funit = {
    for {
      prevPlayers <- fetchPlayers(swiss)
      pairings <- fetchPairings(swiss)
      pairingMap = SwissPairing.toMap(pairings)
      sheets = SwissSheet.many(swiss, prevPlayers, pairingMap)
      withPoints = (prevPlayers zip sheets).map {
        case (player, sheet) => player.copy(points = sheet.points)
      }
      playerMap = SwissPlayer.toMap(withPoints)
      players = withPoints.map { p =>
        val playerPairings = (~pairingMap.get(p.number)).values
        val (tieBreak, perfSum) = playerPairings.foldLeft(0f -> 0f) {
          case ((tieBreak, perfSum), pairing) =>
            val opponent = playerMap.get(pairing opponentOf p.number)
            val opponentPoints = opponent.??(_.points.value)
            val result = pairing.resultFor(p.number)
            val newTieBreak = tieBreak + result.fold(opponentPoints / 2) { _ ?? opponentPoints }
            val newPerf = perfSum + opponent.??(_.rating) + result.?? { win =>
              if (win) 500 else -500
            }
            newTieBreak -> newPerf
        }
        p.copy(
          tieBreak = Swiss.TieBreak(tieBreak),
          performance = playerPairings.nonEmpty option Swiss.Performance(perfSum / playerPairings.size)
        )
          .recomputeScore
      }
      _ <- SwissPlayer.fields { f =>
        prevPlayers
          .zip(players)
          .map {
            case (prev, player) =>
              (prev.score != player.score) ?? playerColl
                .update(
                  $id(player.id),
                  $set(
                    f.points -> player.points,
                    f.tieBreak -> player.tieBreak,
                    f.performance -> player.performance,
                    f.score -> player.score
                  )
                )
                .void
          }
          .sequenceFu
          .void
      }
    } yield {}
  }

  private def fetchPlayers(swiss: Swiss) = SwissPlayer.fields { f =>
    playerColl
      .find($doc(f.swissId -> swiss.id))
      .sort($sort asc f.number)
      .list[SwissPlayer]()
  }

  private def fetchPairings(swiss: Swiss) = SwissPairing.fields { f =>
    pairingColl
      .find($doc(f.swissId -> swiss.id))
      .list[SwissPairing]()
  }
}
