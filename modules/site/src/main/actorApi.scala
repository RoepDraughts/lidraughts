package lidraughts.site
package actorApi

import scala.concurrent.Promise

import lidraughts.socket.DirectSocketMember
import lidraughts.socket.Socket.Uid

case class Member(
    channel: JsChannel,
    userId: Option[String],
    flag: Option[String]
) extends DirectSocketMember {

  def isApi = flag has "api"
}

private[site] case class Join(uid: Uid, userId: Option[String], flag: Option[String], promise: Promise[Connected])
private[site] case class Connected(enumerator: JsEnumerator, member: Member)
