import { h } from 'snabbdom'
import { VNode } from 'snabbdom/vnode'

const scale = 8;
let now: number, startTime: number, stopTime: number;

function displayClockLimit(limit) {
  switch (limit) {
    case 15:
      return '¼';
    case 30:
      return '½';
    case 45:
      return '¾';
    case 90:
      return '1.5';
    default:
      return limit / 60;
  }
}

function displayClock(clock) {
  return displayClockLimit(clock.limit) + "+" + clock.increment;
}

function leftPos(time) {
  return scale * (time - startTime) / 1000 / 60;
}

function laneGrouper(t) {
  if (t.schedule && t.schedule.freq === 'unique') {
    return -1;
  } else if (t.variant.key === 'frisian') {
    if (t.fullName.endsWith('Bullet Arena'))
      return 0;   //frisian bullet among ordinary bullet
    else if (t.schedule.freq === 'daily')
      return 2; // dailies below blitz
    else
      return 1;  //all other timecontrols among blitz
  } else if (t.variant.key !== 'standard') {
    if (t.schedule.freq === 'daily')
        return 2; // dailies below blitz
    else
        return 3; // others below that
  //} else if (t.variant.key !== 'standard' || (t.perf.key === 'rapid' && t.schedule.freq === 'hourly')) {
  //  return 99;
  //} else if (t.perf.key === 'ultraBullet') {
  //  return 70;
  //} else if (t.schedule && t.hasMaxRating) {
  //  return 50 + parseInt(t.fullName.slice(1,5)) / 10000;
  //} else if (t.schedule && t.schedule.speed === 'superblitz') {
  //  return t.perf.position - 0.5;
  } else {
    return t.perf.position;
  }
}

function group(arr, grouper) {
  const groups = {};
  let g;
  arr.forEach(e => {
    g = grouper(e);
    if (!groups[g]) groups[g] = [];
    groups[g].push(e);
  });
  return Object.keys(groups).sort().map(function(k) {
    return groups[k];
  });
}

function fitLane(lane, tour2) {
  return !lane.some(function(tour1) {
    return !(tour1.finishesAt <= tour2.startsAt || tour2.finishesAt <= tour1.startsAt);
  });
}

// splits lanes that have collisions, but keeps
// groups separate by not compacting existing lanes
function splitOverlaping(lanes) {
  let ret: any[] = [], i: number;
  lanes.forEach(lane => {
    var newLanes: any[] = [
      []
    ];
    lane.forEach(tour => {
      let collision = true;
      for (i = 0; i < newLanes.length; i++) {
        if (fitLane(newLanes[i], tour)) {
          newLanes[i].push(tour);
          collision = false;
          break;
        }
      }
      if (collision) newLanes.push([tour]);
    });
    ret = ret.concat(newLanes);
  });
  return ret;
}

function tournamentClass(tour) {
  const finished = tour.status === 30,
    userCreated = tour.createdBy !== 'lidraughts',
    classes = {
      'tsht-rated': tour.rated,
      'tsht-casual': !tour.rated,
      'tsht-finished': finished,
      'tsht-joinable': !finished,
      'tsht-user-created': userCreated,
      'tsht-major': tour.major,
      'tsht-thematic': !!tour.position,
      'tsht-short': tour.minutes <= 30,
      'tsht-max-rating': !userCreated && tour.hasMaxRating
    };
  if (tour.schedule) classes['tsht-' + tour.schedule.freq] = true;
  return classes;
}

function iconOf(tour, perfIcon) {
  return (tour.schedule && tour.schedule.freq === 'shield') ? '5' : perfIcon;
}

let mousedownAt: number[] | undefined;

function renderTournament(ctrl, tour) {
  let width = tour.minutes * scale;
  const left = leftPos(tour.startsAt);
  // moves content into viewport, for long tourneys and marathons
  const paddingLeft = tour.minutes < 90 ? 0 : Math.max(0,
    Math.min(width - 250, // max padding, reserved text space
      leftPos(now) - left - 380)); // distance from Now
  // cut right overflow to fit viewport and not widen it, for marathons
  width = Math.min(width, leftPos(stopTime) - left);

  return h('a.tsht', {
    class: tournamentClass(tour),
    attrs: {
      href: '/tournament/' + tour.id,
      style: 'width: ' + width + 'px; left: ' + left + 'px; padding-left: ' + paddingLeft + 'px'
    }
  }, [
    h('span.icon', tour.perf ? {
      attrs: {
        'data-icon': iconOf(tour, tour.perf.icon),
        title: tour.perf.name
      }
    } : {}),
    h('span.body', [
      h('span.name', tour.fullName),
      h('span.infos', [
        h('span.text', [
          displayClock(tour.clock) + ' ',
          tour.variant.key === 'standard' ? null : tour.variant.name + ' ',
          tour.position ? 'Thematic ' : null,
          tour.rated ? ctrl.trans('ratedTournament') : ctrl.trans('casualTournament')
        ]),
        tour.nbPlayers ? h('span.nb-players', {
          attrs: { 'data-icon': 'r' }
        }, tour.nbPlayers) : null
      ])
    ])
  ]);
}

function renderTimeline() {
  const minutesBetween = 10;
  const time = new Date(startTime);
  time.setSeconds(0);
  time.setMinutes(Math.floor(time.getMinutes() / minutesBetween) * minutesBetween);

  const timeHeaders: VNode[] = [];
  const count = (stopTime - startTime) / (minutesBetween * 60 * 1000);
  for (let i = 0; i < count; i++) {
    timeHeaders.push(h('div.timeheader', {
      class: { hour: !time.getMinutes() },
      attrs: { style: 'left: ' + leftPos(time.getTime()) + 'px' }
    }, timeString(time)));
    time.setUTCMinutes(time.getUTCMinutes() + minutesBetween);
  }
  timeHeaders.push(h('div.timeheader.now', {
    attrs: { style: 'left: ' + leftPos(now) + 'px' }
  }));

  return h('div.timeline', timeHeaders);
}

// converts Date to "%H:%M" with leading zeros
function timeString(time) {
  return ('0' + time.getHours()).slice(-2) + ":" + ('0' + time.getMinutes()).slice(-2);
}

function isSystemTournament(t) {
  return !!t.schedule;
}

export default function(ctrl) {
  now = Date.now();
  startTime = now - 3 * 60 * 60 * 1000;
  stopTime = startTime + 10 * 60 * 60 * 1000;

  const data = ctrl.data();

  const systemTours: any[] = [],
    majorTours: any[] = [],
    userTours: any[] = [];

  data.finished
    .concat(data.started)
    .concat(data.created)
    .filter(t => t.finishesAt > startTime)
    .forEach(t => {
      if (isSystemTournament(t)) systemTours.push(t);
      else if (t.major) majorTours.push(t);
      else userTours.push(t);
    });

  // group system tournaments into dedicated lanes for PerfType
  const tourLanes = splitOverlaping(
    group(systemTours, laneGrouper)
    .concat([majorTours])
    .concat([userTours])
  ).filter(lane => lane.length > 0);

  return h('div.tour-chart', [
    h('div.tour-chart__inner.dragscroll.', {
      hook: {
        insert: vnode => {
          const el = vnode.elm as HTMLElement;
          const bitLater = now + 15 * 60 * 1000;
          el.scrollLeft = leftPos(bitLater - el.clientWidth / 2.5 / scale * 60 * 1000);

          el.addEventListener('mousedown', e => {
            mousedownAt = [e.clientX, e.clientY];
          });
          el.addEventListener('click', e => {
            if (mousedownAt && Math.pow(e.clientX - mousedownAt[0], 2) + Math.pow(e.clientY - mousedownAt[1], 2)) {
              e.preventDefault();
              return false;
            }
            return true;
          });
        }
      }
    }, [
      renderTimeline(),
      ...tourLanes.map(lane => {
        const large = lane.find(t => isSystemTournament(t) || t.major);
        return h('div.tournamentline' + (large ? '.large' : ''), lane.map(tour =>
          renderTournament(ctrl, tour)))
      })
    ])
  ]);
}
