package lidraughts.socket

import scala.concurrent.duration._

import akka.actor.{ Deploy => _, _ }

import lidraughts.hub.actorApi.HasUserId

abstract class SocketActor[M <: SocketMember](val uidTtl: Duration) extends SocketBase[M] with Actor {

  protected val system = context.system

  override def preStart: Unit = {
    lidraughtsBus.publish(lidraughts.socket.SocketHub.Open(self), 'socket)
  }

  override def postStop(): Unit = {
    super.postStop()
    lidraughtsBus.publish(lidraughts.socket.SocketHub.Close(self), 'socket)
    members foreachKey ejectUidString
  }

  protected val receiveActor: PartialFunction[Any, Unit] = {
    case HasUserId(userId) => sender ! hasUserId(userId)
  }

  def receive = receiveSpecific orElse receiveActor orElse receiveGeneric
}
