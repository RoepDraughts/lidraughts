package lidraughts.socket

import draughts.Centis
import io.lettuce.core._
import play.api.libs.json._
import scala.concurrent.Future

import lidraughts.common.Chronometer
import lidraughts.hub.actorApi.relation.ReloadOnlineFriends
import lidraughts.hub.actorApi.round.{ MoveEvent, Mlat }
import lidraughts.hub.actorApi.security.CloseAccount
import lidraughts.hub.actorApi.socket.{ SendTo, SendTos, WithUserIds, RemoteSocketTellSriIn, RemoteSocketTellSriOut }
import lidraughts.hub.actorApi.{ Deploy, Announce }
import lidraughts.socket.actorApi.SendToFlag

final class RemoteSocket(
    redisClient: RedisClient,
    notificationActor: akka.actor.ActorSelection,
    setNb: Int => Unit,
    bus: lidraughts.common.Bus,
    lifecycle: play.api.inject.ApplicationLifecycle
) {

  import RemoteSocket._

  private object In {
    val Connect = "connect"
    val Disconnect = "disconnect"
    val DisconnectAll = "disconnect/all"
    val Watch = "watch"
    val Unwatch = "unwatch"
    val Notified = "notified"
    val Connections = "connections"
    val Lag = "lag"
    val Friends = "friends"
    val TellSri = "tell/sri"
  }
  private abstract class Out(path: String) {
    def apply(args: String*): String = s"$path ${args mkString " "}"
  }
  private object Out {
    def move(gameId: String, move: String, fen: String) =
      s"move $gameId $move $fen"
    def tellUser(userId: String, payload: JsObject) =
      s"tell/user $userId ${Json stringify payload}"
    def tellUsers(userIds: Set[String], payload: JsObject) =
      s"tell/users ${userIds mkString ","} ${Json stringify payload}"
    def tellAll(payload: JsObject) =
      s"tell/all ${Json stringify payload}"
    def tellFlag(flag: String, payload: JsObject) =
      s"tell/flag $flag ${Json stringify payload}"
    def tellSri(sri: String, payload: JsValue) =
      s"tell/sri $sri ${Json stringify payload}"
    def mlat(lat: Int) =
      s"mlat $lat"
    def disconnectUser(userId: String) =
      s"disconnect/user $userId"
  }

  private val connectedUserIds = collection.mutable.Set.empty[String]
  private val watchedGameIds = collection.mutable.Set.empty[String]

  val defaultHandler: Handler = {
    case (In.Connect, userId) => connectedUserIds += userId
    case (In.Disconnect, userId) => connectedUserIds -= userId
    case (In.Watch, gameId) => watchedGameIds += gameId
    case (In.Unwatch, gameId) => watchedGameIds -= gameId
    case (In.Notified, userId) => notificationActor ! lidraughts.hub.actorApi.notify.Notified(userId)
    case (In.Connections, nbStr) =>
      parseIntOption(nbStr) foreach { nb =>
        setNb(nb)
        tick(nb)
      }
    case (In.Friends, userId) => bus.publish(ReloadOnlineFriends(userId), 'reloadOnlineFriends)
    case (In.Lag, args) => args split ' ' match {
      case Array(user, l) => parseIntOption(l) foreach { lag =>
        UserLagCache.put(user, Centis(lag))
      }
      case _ =>
    }
    case (In.TellSri, args) => args.split(" ", 3) match {
      case Array(sri, userOrAnon, payload) => for {
        obj <- Json.parse(payload).asOpt[JsObject]
        typ <- obj str "t"
        dat <- obj obj "d"
        userId = userOrAnon.some.filter("-" !=)
      } bus.publish(RemoteSocketTellSriIn(sri, userId, dat), Symbol(s"remoteSocketIn:$typ"))
      case a => logger.warn(s"Invalid tell/sri $args")
    }
    case (In.DisconnectAll, _) =>
      logger.info("Remote socket disconnect all")
      connectedUserIds.clear
      watchedGameIds.clear
  }

  bus.subscribeFun('moveEvent, 'socketUsers, 'deploy, 'announce, 'mlat, 'sendToFlag, 'remoteSocketOut, 'accountClose) {
    case MoveEvent(gameId, fen, move) =>
      if (watchedGameIds(gameId)) send(Out.move(gameId, move, fen))
    case SendTos(userIds, payload) =>
      val connectedUsers = userIds intersect connectedUserIds
      if (connectedUsers.nonEmpty) send(Out.tellUsers(connectedUsers, payload))
    case SendTo(userId, payload) if connectedUserIds(userId) =>
      send(Out.tellUser(userId, payload))
    case d: Deploy =>
      send(Out.tellAll(Json.obj("t" -> d.key)))
    case Announce(msg) =>
      send(Out.tellAll(Json.obj("t" -> "announce", "d" -> Json.obj("msg" -> msg))))
    case Mlat(ms) =>
      send(Out.mlat(ms))
    case SendToFlag(flag, payload) =>
      send(Out.tellFlag(flag, payload))
    case RemoteSocketTellSriOut(sri, payload) =>
      send(Out.tellSri(sri, payload))
    case CloseAccount(userId) =>
      send(Out.disconnectUser(userId))
    case WithUserIds(f) =>
      f(connectedUserIds)
  }

  private def tick(nbConn: Int): Unit = {
    mon.connections(nbConn)
    mon.sets.users(connectedUserIds.size)
    mon.sets.games(watchedGameIds.size)
  }

  private val mon = lidraughts.mon.socket.remote

  def sendTo(channel: Channel)(path: Path, args: String*): Unit = {
    val chrono = Chronometer.start
    Chronometer.syncMon(_.socket.remote.redis.publishTimeSync) {
      connOut.async.publish(channel, s"$path ${args mkString " "}").thenRun {
        new Runnable { def run = chrono.mon(_.socket.remote.redis.publishTime) }
      }
    }
    mon.redis.out.channel(channel)()
    mon.redis.out.path(channel, path)()
  }

  private val send: (Path, Args*) => Unit = sendTo("site-out") _

  private val connOut = redisClient.connectPubSub()

  def subscribe(channel: Channel)(handler: Handler): Unit = {
    val conn = redisClient.connectPubSub()
    conn.addListener(new pubsub.RedisPubSubAdapter[String, String] {
      override def message(_channel: String, message: String): Unit = {
        val parts = message.split(" ", 2)
        val path = parts(0)
        mon.redis.in.channel(channel)()
        mon.redis.in.path(channel, path)()
        handler(path, ~parts.lift(1))
      }
    })
    conn.async.subscribe(channel)
  }

  lifecycle.addStopHook { () =>
    logger.info("Stopping the Redis pool...")
    Future {
      redisClient.shutdown();
    }
  }
}

object RemoteSocket {
  type Channel = String
  type Path = String
  type Args = String
  type Handler = PartialFunction[(Path, Args), Unit]
}
