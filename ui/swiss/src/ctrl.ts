import makeSocket from './socket';
import xhr from './xhr';
import { myPage, players } from './pagination';
import { SwissData, SwissOpts, Pages, Standing, Player } from './interfaces';
import { SwissSocket } from './socket';

export default class SwissController {

  opts: SwissOpts;
  data: SwissData;
  trans: Trans;
  socket: SwissSocket;
  page: number;
  pages: Pages = {};
  lastPageDisplayed: number | undefined;
  focusOnMe: boolean;
  joinSpinner: boolean = false;
  disableClicks: boolean = true;
  searching: boolean = false;
  redraw: () => void;

  private lastStorage = window.lidraughts.storage.make('last-redirect');

  constructor(opts: SwissOpts, redraw: () => void) {
    this.opts = opts;
    this.data = opts.data;
    this.redraw = redraw;
    this.trans = window.lidraughts.trans(opts.i18n);
    this.socket = makeSocket(opts.socketSend, this);
    this.page = this.data.standing.page;
    this.focusOnMe = this.isIn();
    setTimeout(() => this.disableClicks = false, 1500);
    this.loadPage(this.data.standing);
    this.scrollToMe();
    this.redirectToMyGame();
  }

  reload = (data: SwissData): void => {
    this.data = {...this.data, ...data};
    this.data.me = data.me; // to account for removal on withdraw
    // if (data.playerInfo && data.playerInfo.player.id === this.playerInfo.id)
    //   this.playerInfo.data = data.playerInfo;
    this.loadPage(data.standing);
    if (this.focusOnMe) this.scrollToMe();
    // if (data.featured) this.startWatching(data.featured.id);
    this.joinSpinner = false;
    this.redirectToMyGame();
  };

  isCreated = () => this.data.status == 'created';
  isStarted = () => this.data.status == 'started';
  isFinished = () => this.data.status == 'finished';

  myGameId = () => this.data.me?.gameId;

  join = () => {
    xhr.join(this);
    this.joinSpinner = true;
    this.focusOnMe = true;
  }

  withdraw = () => {
    xhr.withdraw(this);
    this.joinSpinner = true;
    this.focusOnMe = false;
  };

  private redirectToMyGame() {
    const gameId = this.myGameId();
    if (gameId) this.redirectFirst(gameId);
  }

  redirectFirst = (gameId: string, rightNow?: boolean) => {
    const delay = (rightNow || document.hasFocus()) ? 10 : (1000 + Math.random() * 500);
    setTimeout(() => {
      if (this.lastStorage.get() !== gameId) {
        this.lastStorage.set(gameId);
        window.lidraughts.redirect('/' + gameId);
      }
    }, delay);
  };

  scrollToMe = () => {
    const page = myPage(this);
    if (page && page !== this.page) this.setPage(page);
  };

  loadPage = (data: Standing) => {
    if (!this.pages[data.page]) this.pages[data.page] = data.players;
  }

  setPage = (page: number) => {
    this.page = page;
    xhr.loadPage(this, page);
  };

  toggleFocusOnMe = () => {
    if (this.data.me) {
      this.focusOnMe = !this.focusOnMe;
      if (this.focusOnMe) this.scrollToMe();
    }
  };

  toggleSearch = () => this.searching = !this.searching;

  jumpToPageOf = (name: string) => {
    const userId = name.toLowerCase();
    xhr.loadPageOf(this, userId).then(data => {
      this.loadPage(data);
      this.page = data.page;
      this.searching = false;
      this.focusOnMe = false;
      this.redraw();
    });
  }

  userSetPage = (page: number) => {
    this.focusOnMe = false;
    this.setPage(page);
  };

  userNextPage = () => this.userSetPage(this.page + 1);
  userPrevPage = () => this.userSetPage(this.page - 1);
  userLastPage = () => this.userSetPage(players(this).nbPages);

  showPlayerInfo = (player: Player) => {
  };

  askReload = () => xhr.reloadNow(this);

  private isIn = () => this.data.me && !this.data.me.withdraw;
}
