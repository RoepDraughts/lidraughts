package lidraughts.pool

import org.joda.time.DateTime

import lidraughts.rating.RatingRange
import lidraughts.user.User
import lidraughts.playban.RageSit

case class PoolMember(
    userId: User.ID,
    uid: lidraughts.socket.Socket.Uid,
    rating: Int,
    ratingRange: Option[RatingRange],
    lame: Boolean,
    blocking: PoolMember.BlockedUsers,
    since: DateTime,
    rageSitCounter: Int,
    misses: Int = 0 // how many waves they missed
) {

  def incMisses = copy(misses = misses + 1)

  def waitMillis: Int = (DateTime.now.getMillis - since.getMillis).toInt

  def ratingDiff(other: PoolMember) = Math.abs(rating - other.rating)

  def withRange(r: Option[RatingRange]) =
    if (r == ratingRange) this
    else copy(ratingRange = r, misses = 0)

  def hasRange = ratingRange.isDefined
}

object PoolMember {

  case class BlockedUsers(ids: Set[User.ID]) extends AnyVal

  def apply(joiner: PoolApi.Joiner, config: PoolConfig, rageSit: RageSit): PoolMember =
    PoolMember(
      userId = joiner.userId,
      uid = joiner.uid,
      lame = joiner.lame,
      rating = joiner.ratingMap.getOrElse(config.perfType.key, 1500),
      ratingRange = joiner.ratingRange,
      blocking = BlockedUsers(joiner.blocking),
      since = DateTime.now,
      rageSitCounter = rageSit.counter / 10
    )
}
