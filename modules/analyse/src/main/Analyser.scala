package lidraughts.analyse

import akka.actor.ActorSelection

import draughts.format.FEN
import lidraughts.game.actorApi.InsertGame
import lidraughts.game.{ GameRepo, Game }
import lidraughts.hub.actorApi.map.TellIfExists

final class Analyser(
    indexer: ActorSelection,
    requesterApi: RequesterApi,
    bus: lidraughts.common.Bus
) {

  def get(game: Game): Fu[Option[Analysis]] =
    AnalysisRepo byGame game

  def byId(id: Analysis.ID): Fu[Option[Analysis]] = AnalysisRepo byId id

  def save(analysis: Analysis): Funit = analysis.studyId match {
    case None => GameRepo game analysis.id flatMap {
      _ ?? { game =>
        GameRepo.setAnalysed(game.id)
        AnalysisRepo.save(analysis) >>
          sendAnalysisProgress(analysis, complete = true) >>- {
            bus.publish(actorApi.AnalysisReady(game, analysis), 'analysisReady)
            bus.publish(InsertGame(game), 'gameSearchInsert)
            requesterApi save analysis
          }
      }
    }
    case Some(studyId) =>
      AnalysisRepo.save(analysis) >>
        sendAnalysisProgress(analysis, complete = true) >>- {
          requesterApi save analysis
        }
  }

  def progress(analysis: Analysis): Funit = sendAnalysisProgress(analysis, complete = false)

  private def sendAnalysisProgress(analysis: Analysis, complete: Boolean): Funit = analysis.studyId match {
    case None => GameRepo gameWithInitialFen analysis.id map {
      _ ?? {
        case (game, initialFen) => bus.publish(
          TellIfExists(analysis.id, actorApi.AnalysisProgress(
            analysis = analysis,
            game = game,
            variant = game.variant,
            initialFen = initialFen | FEN(game.variant.initialFen)
          )),
          'roundSocket
        )
      }
    }
    case Some(studyId) => fuccess {
      bus.publish(actorApi.StudyAnalysisProgress(analysis, complete), 'studyAnalysisProgress)
    }
  }
}
