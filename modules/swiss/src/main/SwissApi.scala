package lidraughts.swiss

import org.joda.time.DateTime

import lidraughts.hub.lightTeam.TeamId
import lidraughts.user.User
import lidraughts.db.dsl._
import lidraughts.common.GreatPlayer

final class SwissApi(
    swissColl: Coll,
    pairingColl: Coll
) {

  import BsonHandlers._

  def byId(id: Swiss.Id) = swissColl.byId[Swiss](id.value)

  def create(data: SwissForm.SwissData, me: User, teamId: TeamId): Fu[Swiss] = {
    val swiss = Swiss(
      _id = Swiss.makeId,
      name = data.name | GreatPlayer.randomName,
      status = Status.Created,
      clock = data.clock,
      variant = data.realVariant,
      rated = data.rated | true,
      round = SwissRound.Number(0),
      nbRounds = data.nbRounds,
      nbPlayers = 0,
      createdAt = DateTime.now,
      createdBy = me.id,
      teamId = teamId,
      startsAt = data.startsAt,
      winnerId = none,
      description = data.description,
      hasChat = data.hasChat | true
    )
    swissColl.insert(swiss) inject swiss
  }

  def pairingsOf(swiss: Swiss) =
    pairingColl.find($doc("s" -> swiss.id)).sort($sort asc "r").list[SwissPairing]()

  def featuredInTeam(teamId: TeamId): Fu[List[Swiss]] =
    swissColl.find($doc("teamId" -> teamId)).sort($sort desc "startsAt").list[Swiss](5)
}
