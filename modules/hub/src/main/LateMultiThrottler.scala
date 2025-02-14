package lidraughts.hub

import akka.actor._
import scala.concurrent.duration._

/**
 * Delays the work,
 * only runs once at a time per id.
 * Guarantees that work is ran as late as possible.
 */
final class LateMultiThrottler(
    executionTimeout: Option[FiniteDuration] = None,
    logger: lidraughts.log.Logger
) extends Actor {

  import LateMultiThrottler._

  var executions = Set.empty[String]

  def receive: Receive = {

    case Work(id, run, delayOption, timeoutOption) if !executions.contains(id) =>
      implicit val system = context.system
      lidraughts.common.Future.delay(delayOption | 0.seconds) {
        timeoutOption.orElse(executionTimeout).fold(run()) { timeout =>
          run().withTimeout(
            duration = timeout,
            error = lidraughts.base.LidraughtsException(s"LateMultiThrottler timed out after $timeout")
          )
        } addEffectAnyway {
          self ! Done(id)
        }
      }
      executions = executions + id

    case _: Work => // already executing similar work

    case Done(id) =>
      executions = executions - id

    case x => logger.branch("LateMultiThrottler").warn(s"Unsupported message $x")
  }
}

object LateMultiThrottler {

  def apply(
    executionTimeout: Option[FiniteDuration] = None,
    logger: lidraughts.log.Logger
  )(implicit system: ActorSystem) =
    system.actorOf(Props(new LateMultiThrottler(executionTimeout, logger)))

  case class Work(
      id: String,
      run: () => Funit,
      delay: Option[FiniteDuration], // how long to wait before running
      timeout: Option[FiniteDuration]
  ) // how long to wait before timing out

  case class Done(id: String)

  def work(
    id: String,
    run: => Funit,
    delay: Option[FiniteDuration] = None,
    timeout: Option[FiniteDuration] = None
  ) =
    Work(id, () => run, delay, timeout)
}
