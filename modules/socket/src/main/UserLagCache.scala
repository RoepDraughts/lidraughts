package lidraughts.socket

import draughts.Centis
import com.github.blemale.scaffeine.{ Cache, Scaffeine }
import scala.concurrent.duration._

object UserLagCache {
  private val cache: Cache[String, Centis] = Scaffeine()
    .expireAfterWrite(15.minute)
    .build[String, Centis]

  def put(userId: String, lag: Centis): Unit = if (lag.centis >= 0) {
    cache.put(userId, cache.getIfPresent(userId).fold(lag) {
      _ avg lag
    })
  }

  def get(userId: String): Option[Centis] = cache.getIfPresent(userId)

  def getLagRating(userId: String): Option[Int] = get(userId) map {
    case i if i <= Centis(15) => 4
    case i if i <= Centis(30) => 3
    case i if i <= Centis(50) => 2
    case _ => 1
  }
}
