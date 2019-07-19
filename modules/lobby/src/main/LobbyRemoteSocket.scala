package lidraughts.lobby

import play.api.libs.json._

import actorApi._
import lidraughts.socket.RemoteSocket.{ Protocol => P, _ }
import lidraughts.user.{ User, UserRepo }

final class LobbyRemoteSocket(
    remoteSocketApi: lidraughts.socket.RemoteSocket,
    socket: LobbySocket,
    blocking: User.ID => Fu[Set[User.ID]],
    controller: LobbySocketMember => lidraughts.socket.Handler.Controller,
    bus: lidraughts.common.Bus
) {

  import LobbyRemoteSocket.Protocol._

  private val send: (Path, Args*) => Unit = remoteSocketApi.sendTo("lobby-out") _

  private val handler: Handler = {
    case P.In.ConnectSri(sri, userOpt) =>
      userOpt map P.In.ConnectUser.apply foreach remoteSocketApi.baseHandler.lift
      userOpt ?? UserRepo.enabledById foreach { user =>
        (user ?? (u => blocking(u.id))) foreach { blocks =>
          val member = actorApi.LobbySocketMember(js => send(P.Out.tellSri(sri, js)), user, blocks, sri)
          socket ! actorApi.JoinRemote(member)
        }
      }
    case P.In.DisconnectSri(sri, userOpt) =>
      userOpt map P.In.DisconnectUser.apply foreach remoteSocketApi.baseHandler.lift

    case tell @ P.In.TellSri(sri, _, typ, msg) if messagesHandled(typ) =>
      socket.ask[Option[LobbyRemoteSocketMember]](GetRemoteMember(sri, _)) foreach {
        case None => logger.warn(s"tell/sri missing member $sri")
        case Some(member) => controller(member).applyOrElse(typ -> msg, {
          case _ => logger.warn(s"Can't handle $typ")
        }: lidraughts.socket.Handler.Controller)
      }
  }

  private val messagesHandled: Set[String] =
    Set("join", "cancel", "joinSeek", "cancelSeek", "idle", "poolIn", "poolOut", "hookIn", "hookOut")

  remoteSocketApi.subscribe("lobby-in", P.In.baseReader)(handler orElse remoteSocketApi.baseHandler)

  bus.subscribeFun('nbMembers, 'nbRounds) {
    case lidraughts.socket.actorApi.NbMembers(nb) => send(Out.nbMembers(nb))
    case lidraughts.hub.actorApi.round.NbRounds(nb) => send(Out.nbRounds(nb))
  }
}

object LobbyRemoteSocket {

  object Protocol {
    object Out {
      def nbMembers(nb: Int) = s"member/nb $nb"
      def nbRounds(nb: Int) = s"round/nb $nb"
    }
  }
}
