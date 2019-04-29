(function() {

  $.ajaxSetup({
    cache: false
  });
  $.ajaxTransport('script', function(s) {
    // Monkeypatch jQuery to load scripts with nonce. Upstream patch:
    // - https://github.com/jquery/jquery/pull/3766
    // - https://github.com/jquery/jquery/pull/3782
    // Original transport:
    // https://github.com/jquery/jquery/blob/master/src/ajax/script.js
    var script, callback;
    return {
      send: function(_, complete) {
        script = $("<script>").prop({
          nonce: document.body.getAttribute('data-nonce'), // Add the nonce!
          charset: s.scriptCharset,
          src: s.url
        }).on("load error", callback = function(evt) {
          script.remove();
          callback = null;
          if (evt) {
            complete(evt.type === "error" ? 404 : 200, evt.type);
          }
        });
        document.head.appendChild(script[0]);
      },
      abort: function() {
        if (callback) {
          callback();
        }
      }
    };
  });
  $.userLink = function(u) {
    return $.userLinkLimit(u, false);
  };
  $.userLinkLimit = function(u, limit, klass) {
    var split = u.split(' ');
    var id = split.length == 1 ? split[0] : split[1];
    return u ? '<a class="user-link ulpt ' + (klass || '') + '" href="/@/' + id + '">' + (limit ? u.substring(0, limit) : u) + '</a>' : 'Anonymous';
  };

  lidraughts.socket = null;
  $.extend(true, lidraughts.StrongSocket.defaults, {
    events: {
      following_onlines: function(d, all) {
        $('#friend_box').friends("set", all.d, all.playing, all.studying, all.patrons);
      },
      following_enters: function(d, all) {
        $('#friend_box').friends('enters', all.d, all.playing, all.studying, all.patron);
      },
      following_leaves: function(name) {
        $('#friend_box').friends('leaves', name);
      },
      following_playing: function(name) {
        $('#friend_box').friends('playing', name);
      },
      following_stopped_playing: function(name) {
        $('#friend_box').friends('stopped_playing', name);
      },
      following_joined_study: function(name) {
        $('#friend_box').friends('study_join', name);
      },
      following_left_study: function(name) {
        $('#friend_box').friends('study_leave', name);
      },
      new_notification: function(e) {
        $('#notify-toggle').attr('data-count', e.unread || 0);
        lidraughts.sound.newPM();
      },
      redirect: function(o) {
        setTimeout(function() {
          lidraughts.hasToReload = true;
          lidraughts.redirect(o);
        }, 200);
      },
      deployPost: function(html) {
        $('#notifications').append(
          '<div id="deploy_post" class="notification">' +
          '<div class="inner"><p data-icon="j" class="is3 text">Site update in progress...</p></div>' +
          '</div>');
        lidraughts.socket.disconnect(function() {
          $('#deploy_post').remove();
          $('#notifications').append(
            '<div id="deploy_done" class="notification">' +
            '<div class="inner"><p data-icon="E" class="is3 is-green text">Site update complete.</p></div>' +
            '</div>');
          setTimeout(function() {
            $('#deploy_done').fadeOut(1000).remove();
          }, $('body').hasClass('playing') ? 9000 : 15000);
        });
      },
      tournamentReminder: function(data) {
        if ($('#tour-reminder').length || $('body').data("tournament-id") == data.id) return;
        var url = '/tournament/' + data.id;
        $('body').append(
          '<div id="tour-reminder">' +
          '<a data-icon="g" class="text" href="' + url + '">' + data.name + '</a>in progress!' +
          '<div class="actions">' +
          '<a class="withdraw text" href="' + url + '/withdraw" data-icon="Z">Pause</a>' +
          '<a class="text" href="' + url + '" data-icon="G">Join</a>' +
          '</div></div>'
        ).find("a.withdraw").click(function() {
          $.post($(this).attr("href"));
          $('#tour-reminder').remove();
          return false;
        });
      }
    },
    params: {},
    options: {
      name: "site",
      lagTag: null,
      isAuth: !!$('body').data('user')
    }
  });

  lidraughts.readServerFen = function(t) {
    return atob(t.split("").reverse().join(""));
  };

  lidraughts.userAutocomplete = function($input, opts) {
    opts = opts || {};
    lidraughts.loadCssPath('autocomplete');
    return lidraughts.loadScript('javascripts/vendor/typeahead.jquery.min.js', {noVersion:true}).done(function() {
      $input.typeahead({
        minLength: opts.minLength || 3,
      }, {
        hint: true,
        highlight: false,
        source: function(query, _, runAsync) {
          if (query.trim().match(/^[a-z0-9][\w-]{2,29}$/i)) $.ajax({
            url: '/player/autocomplete',
            cache: true,
            data: {
              term: query,
              friend: opts.friend ? 1 : 0,
              tour: opts.tour,
              object: 1
            },
            success: function(res) {
              res = res.result;
              // hack to fix typeahead limit bug
              if (res.length === 10) res.push(null);
              runAsync(res);
            }
          });
        },
        limit: 10,
        displayKey: 'name',
        templates: {
          empty: '<div class="empty">No player found</div>',
          pending: lidraughts.spinnerHtml,
          suggestion: function(o) {
            var tag = opts.tag || 'a';
            return '<' + tag + ' class="ulpt user-link' + (o.online ? ' online' : '') + '" ' + (tag === 'a' ? '' : 'data-') + 'href="/@/' + o.name + '">' +
              '<i class="line' + (o.patron ? ' patron' : '') + '"></i>' + (o.title ? '<span class="title">' + o.title + '</span>&nbsp;' : '')  + o.name +
              '</' + tag + '>';
          }
        }
      }).on('typeahead:render', function() {
        lidraughts.pubsub.emit('content_loaded')();
      });
      if (opts.focus) $input.focus();
      if (opts.onSelect) $input.on('typeahead:select', function(ev, sel) {
        opts.onSelect(sel);
      }).on('keypress', function(e) {
        if (e.which == 10 || e.which == 13) opts.onSelect($(this).val());
      });
    });
  };

  lidraughts.parseFen = function($elem) {
    if (!window.Draughtsground) return setTimeout(function() {
      lidraughts.parseFen($elem);
    }, 500); // if not loaded yet
    // sometimes $elem is not a jQuery, can happen when content_loaded is triggered with random args
    if (!$elem || !$elem.each) $elem = $('.parse-fen');
    $elem.each(function() {
      var $this = $(this).removeClass('parse-fen');
      var lm = $this.data('lastmove');
      var lastMove = lm && (lm[1] === '@' ? [lm.toString().slice(2)] : [lm.toString()[0] + lm.toString()[1], lm.toString()[2] + lm.toString()[3]]);
      var color = $this.data('color') || lidraughts.readServerFen($(this).data('y'));
      var ground = $this.data('draughtsground');
      var playable = !!$this.data('playable');
      var resizable = !!$this.data('resizable');
      var config = {
        coordinates: 0,
        viewOnly: !playable,
        resizable: resizable,
        fen: $this.data('fen') || lidraughts.readServerFen($this.data('z')),
        lastMove: lastMove,
        drawable: { enabled: false, visible: false }
      };
      if (color) config.orientation = color;
      if (ground) ground.set(config);
      else $this.data('draughtsground', Draughtsground(this, config));
    });
  };

  $(function() {
    if (lidraughts.analyse) LidraughtsAnalyse.boot(lidraughts.analyse);
    else if (lidraughts.user_analysis) startUserAnalysis(lidraughts.user_analysis);
    else if (lidraughts.study) startStudy(lidraughts.study);
    else if (lidraughts.practice) startPractice(lidraughts.practice);
    else if (lidraughts.relay) startRelay(lidraughts.relay);
    else if (lidraughts.puzzle) startPuzzle(lidraughts.puzzle);
    else if (lidraughts.tournament) startTournament(lidraughts.tournament);
    else if (lidraughts.simul) startSimul(lidraughts.simul);

    // delay so round starts first (just for perceived perf)
    lidraughts.requestIdleCallback(function() {

      $('#reconnecting').on('click', function() {
        window.location.reload();
      });

      $('#friend_box').friends();

      $('#main-wrap')
        .on('click', '.autoselect', function() {
          $(this).select();
        })
        .on('click', 'button.copy', function() {
          $('#' + $(this).data('rel')).select();
          document.execCommand('copy');
          $(this).attr('data-icon', 'E');
        });
      $('body').on('click', 'a.relation-button', function() {
        var $a = $(this).addClass('processing').css('opacity', 0.3);
        $.ajax({
          url: $a.attr('href'),
          type: 'post',
          success: function(html) {
            if (html.includes('relation-actions')) $a.parent().replaceWith(html);
            else $a.replaceWith(html);
          }
        });
        return false;
      });

      $('.mselect .button').on('click', function() {
        var $p = $(this).parent();
        $p.toggleClass('shown');
        setTimeout(function() {
          var handler = function(e) {
            if ($.contains($p[0], e.target)) return;
            $p.removeClass('shown');
            $('html').off('click', handler);
          };
          $('html').on('click', handler);
        }, 10);
      });

      document.body.addEventListener('mouseover', lidraughts.powertip.mouseover);

      function renderTimeago() {
        lidraughts.raf(function() {
          lidraughts.timeago.render([].slice.call(document.getElementsByClassName('timeago'), 0, 99));
        });
      }
      function setTimeago(interval) {
        renderTimeago();
        setTimeout(function() { setTimeago(interval * 1.1); }, interval);
      }
      setTimeago(1200);
      lidraughts.pubsub.on('content_loaded', renderTimeago);

      if (!window.customWS) setTimeout(function() {
        if (lidraughts.socket === null) lidraughts.socket = lidraughts.StrongSocket("/socket/v3", false);
      }, 300);

      var initiatingHtml = '<div class="initiating">' + lidraughts.spinnerHtml + '</div>';

      lidraughts.challengeApp = (function() {
        var instance, booted;
        var $toggle = $('#challenge-toggle');
        $toggle.one('mouseover click', function() {
          load();
        });
        var load = function(data) {
          if (booted) return;
          booted = true;
          var $el = $('#challenge-app').html(initiatingHtml);
          lidraughts.loadCssPath('challenge');
          lidraughts.loadScript(lidraughts.compiledScript('challenge')).done(function() {
            instance = LidraughtsChallenge.default($el[0], {
              data: data,
              show: function() {
                if (!$('#challenge-app').is(':visible')) $toggle.click();
              },
              setCount: function(nb) {
                $toggle.find('span').attr('data-count', nb);
              },
              pulse: function() {
                $toggle.addClass('pulse');
              }
            });
          });
        };
        return {
          update: function(data) {
            if (!instance) load(data);
            else instance.update(data);
          },
          open: function() {
            $toggle.click();
          }
        };
      })();

      lidraughts.notifyApp = (function() {
        var instance, booted;
        var $toggle = $('#notify-toggle');
        var isVisible = function() {
          return $('#notify-app').is(':visible');
        };

        var load = function(data, incoming) {
          if (booted) return;
          booted = true;
          var $el = $('#notify-app').html(initiatingHtml);
          lidraughts.loadCssPath('notify');
          lidraughts.loadScript(lidraughts.compiledScript('notify')).done(function() {
            instance = LidraughtsNotify.default($el.empty()[0], {
              data: data,
              incoming: incoming,
              isVisible: isVisible,
              setCount: function(nb) {
                $toggle.find('span').attr('data-count', nb);
              },
              show: function() {
                if (!isVisible()) $toggle.click();
              },
              setNotified: function() {
                lidraughts.socket.send('notified');
              },
              pulse: function() {
                $toggle.addClass('pulse');
              }
            });
          });
        };

        $toggle.one('mouseover click', function() {
          load();
        }).click(function() {
          setTimeout(function() {
            if (instance && isVisible()) instance.setVisible();
          }, 200);
        });

        return {
          update: function(data, incoming) {
            if (!instance) load(data, incoming);
            else instance.update(data, incoming);
          }
        };
      })();

      window.addEventListener('resize', () => lidraughts.dispatchEvent(document.body, 'draughtsground.resize'));

      // dasher
      (function() {
        var booted;
        $('#top .dasher .toggle').one('mouseover click', function() {
          if (booted) return;
          booted = true;
          var $el = $('#dasher_app').html(initiatingHtml);
          var isPlaying = $('body').hasClass('playing');
          lidraughts.loadCssPath('dasher');
          lidraughts.loadScript(lidraughts.compiledScript('dasher')).done(function() {
            LidraughtsDasher.default($el.empty()[0], {
              playing: isPlaying
            });
          });
        });
      })();

      // cli
      (function() {
        var $wrap = $('#clinput');
        if (!$wrap.length) return;
        var booted;
        var boot = function() {
          if (booted) return $.Deferred().resolve();
          booted = true;
          return lidraughts.loadScript(lidraughts.compiledScript('cli')).done(function() {
            LidraughtsCli.app($wrap, toggle);
          });
        }
        var toggle = function(txt) {
          boot().done(function() {
            $wrap.find('input').val(txt || '');
          });
          $('#top').toggleClass('clinput');
          if ($('#top').hasClass('clinput')) $wrap.find('input').focus();
        };
        $wrap.find('a').on('mouseover click', function(e) {
          (e.type === 'mouseover' ? boot : toggle)();
        });
        Mousetrap.bind('/', function() {
          lidraughts.raf(function() { toggle('/') });
          return false;
        });
        Mousetrap.bind('s', function() {
          lidraughts.raf(function() { toggle() });
        });
      })();

      $('.user-autocomplete').each(function() {
        var opts = {
          focus: 1,
          friend: $(this).data('friend'),
          tag: $(this).data('tag')
        };
        if ($(this).attr('autofocus')) lidraughts.userAutocomplete($(this), opts);
        else $(this).one('focus', function() {
          lidraughts.userAutocomplete($(this), opts);
        });
      });

      $('#topnav-toggle').on('change', e => {
        document.body.classList.toggle('masked', e.target.checked);
      });

      lidraughts.loadInfiniteScroll = function(el) {
        $(el).each(function() {
          if (!$('.pager a', this).length) return;
          var $scroller = $(this).infinitescroll({
            navSelector: ".pager",
            nextSelector: ".pager a",
            itemSelector: ".infinitescroll .paginated",
            errorCallback: function() {
              $("#infscr-loading").remove();
            },
            loading: {
              msg: $('<div id="infscr-loading">').html(lidraughts.spinnerHtml)
            }
          }, function() {
            $("#infscr-loading").remove();
            lidraughts.pubsub.emit('content_loaded')();
            var ids = [];
            $(el).find('.paginated[data-dedup]').each(function() {
              var id = $(this).data('dedup');
              if (id) {
                if (ids.includes(id)) $(this).remove();
                else ids.push(id);
              }
            });
          }).find('div.pager').hide().end();
          $scroller.parent().append($('<button class="inf-more button button-empty">More</button>').on('click', function() {
            $scroller.infinitescroll('retrieve');
          }));
        });
      }
      lidraughts.loadInfiniteScroll('.infinitescroll');

      $('#top').on('click', 'a.toggle', function() {
        var $p = $(this).parent();
        $p.toggleClass('shown');
        $p.siblings('.shown').removeClass('shown');
        lidraughts.pubsub.emit('top.toggle.' + $(this).attr('id'))();
        setTimeout(function() {
          var handler = function(e) {
            if ($.contains($p[0], e.target)) return;
            $p.removeClass('shown');
            $('html').off('click', handler);
          };
          $('html').on('click', handler);
        }, 10);
        return false;
      });

      $('a.delete, input.delete').click(function() {
        return confirm('Delete?');
      });
      $('input.confirm, button.confirm').click(function() {
        return confirm($(this).attr('title') || 'Confirm this action?');
      });

      $('#main-wrap').on('click', 'a.bookmark', function() {
        var t = $(this).toggleClass("bookmarked");
        $.post(t.attr("href"));
        var count = (parseInt(t.text(), 10) || 0) + (t.hasClass("bookmarked") ? 1 : -1);
        t.find('span').html(count > 0 ? count : "");
        return false;
      });

      // still bind esc even in form fields
      Mousetrap.prototype.stopCallback = function(e, el, combo) {
        return combo !== 'esc' && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA');
      };
      Mousetrap.bind('esc', function() {
        var $oc = $('#modal-wrap .close');
        if ($oc.length) $oc.trigger('click');
        else {
          $input = $(':focus');
          if ($input.length) $input.trigger('blur');
        }
        return false;
      });

      if (!lidraughts.storage.get('grid')) setTimeout(function() {
        if (getComputedStyle(document.body).getPropertyValue('--grid'))
          lidraughts.storage.set('grid', 1);
        else
          $.get(lidraughts.assetUrl('oops/browser.html'), html => $('body').prepend(html))
      }, 3000);

      if (window.Fingerprint2) setTimeout(function() {
        var t = Date.now()
        new Fingerprint2({
          excludeJsFonts: true
        }).get(function(res) {
          $i = $('#signup-fp-input');
          if ($i.length) $i.val(res);
          else $.post('/auth/set-fp/' + res + '/' + (Date.now() - t));
        });
      }, 500);
    });
  });

  lidraughts.sound = (function() {
    var api = {};
    var soundSet = $('body').data('sound-set');

    api.volumeStorage = lidraughts.storage.make('sound-volume');
    api.defaultVolume = 0.7;

    var memoize = function(factory) {
      var loaded = {};
      var f = function(key) {
        if (!loaded[key]) loaded[key] = factory(key);
        return loaded[key];
      };
      f.clear = function() {
        loaded = {};
      };
      return f;
    };

    var names = {
      genericNotify: 'GenericNotify',
      move: 'Move',
      capture: 'Capture',
      explode: 'Explosion',
      lowtime: 'LowTime',
      victory: 'Victory',
      defeat: 'Defeat',
      draw: 'Draw',
      tournament1st: 'Tournament1st',
      tournament2nd: 'Tournament2nd',
      tournament3rd: 'Tournament3rd',
      tournamentOther: 'TournamentOther',
      berserk: 'Berserk',
      check: 'Check',
      newChallenge: 'NewChallenge',
      newPM: 'NewPM',
      confirmation: 'Confirmation'
    };
    for (var i = 0; i <= 10; i++) names['countDown' + i] = 'CountDown' + i;

    var volumes = {
      lowtime: 0.5,
      explode: 0.35,
      confirmation: 0.5
    };
    var collection = new memoize(function(k) {
      var set = soundSet;
      if (set === 'music' || set === 'speech') {
        if (['move', 'capture', 'check'].includes(k)) return {
          play: $.noop
        };
        set = 'standard';
      }
      var baseUrl = lidraughts.assetUrl('sound', {noVersion: true});
      return new Howl({
        src: ['ogg', 'mp3'].map(function(ext) {
          return [baseUrl, set, names[k] + '.' + ext].join('/');
        }),
        volume: volumes[k] || 1
      });
    });
    var enabled = function() {
      return soundSet !== 'silent';
    };
    Object.keys(names).forEach(function(name) {
      api[name] = function() {
        if (!enabled()) return;
        Howler.volume(api.volumeStorage.get() || api.defaultVolume);
        var sound = collection(name);
        if (Howler.ctx.state == "suspended") {
          Howler.ctx.resume().then(function() { sound.play() });
        } else {
          sound.play();
        }
      }
    });
    api.load = function(name) {
      if (enabled() && name in names) collection(name);
    };
    api.setVolume = function(v) {
      api.volumeStorage.set(v);
      Howler.volume(v);
    };

    var publish = function() {
      lidraughts.pubsub.emit('sound_set')(soundSet);
    };
    setTimeout(publish, 500);

    api.changeSet = function(s) {
      soundSet = s;
      collection.clear();
      publish();
    };

    api.warmup = function() {
      if (enabled()) {
        // See goldfire/howler.js#715
        Howler._autoResume();   // This resumes sound if suspended.
        Howler._autoSuspend();  // This starts the 30s timer to suspend.
      }
    };

    api.set = function() {
      return soundSet;
    };
    return api;
  })();

  lidraughts.widget('watchers', {
    _create: function() {
      this.list = this.element.find(".list");
      this.number = this.element.find(".number");
      lidraughts.pubsub.on('socket.in.crowd', data => this.set(data.watchers || data));
      lidraughts.watchersData && this.set(lidraughts.watchersData);
    },
    set: function(data) {
      lidraughts.watchersData = data;
      if (!data || !data.nb) return this.element.addClass('none');
      if (this.number.length) this.number.text(data.nb);
      if (data.users) {
        var tags = data.users.map($.userLink);
        if (data.anons === 1) tags.push('Anonymous');
        else if (data.anons) tags.push('Anonymous(' + data.anons + ')');
        this.list.html(tags.join(', '));
      } else if (!this.number.length) this.list.html(data.nb + ' players in the chat');
      this.element.removeClass('none');
    }
  });

  lidraughts.widget("friends", (function() {
    var getId = function(titleName) {
      return titleName.toLowerCase().replace(/^\w+\s/, '');
    };
    var makeUser = function(titleName) {
      var split = titleName.split(' ');
      return {
        id: split[split.length - 1].toLowerCase(),
        name: split[split.length - 1],
        title: (split.length > 1) ? split[0] : undefined,
        playing: false,
        studying: false,
        patron: false
      };
    };
    var renderUser = function(user) {
      var icon = '<i class="line' + (user.patron ? ' patron' : '') + '"></i>';
      var titleTag = user.title ? ('<span class="title"' + (user.title === 'BOT' ? ' data-bot' : '') + '>' + user.title + '</span>&nbsp;') : '';
      var url = '/@/' + user.name;
      var tvButton = user.playing ? '<a data-icon="1" class="tv ulpt" data-pt-pos="nw" href="' + url + '/tv" data-href="' + url + '"></a>' : '';
      var studyButton = user.studying ? '<a data-icon="4" class="friend-study" href="' + url + '/studyTv"></a>' : '';
      var rightButton = tvButton || studyButton;
      return '<div><a class="user-link ulpt" data-pt-pos="nw" href="' + url + '">' + icon + titleTag + user.name + '</a>' + rightButton + '</div>';
    };
    return {
      _create: function() {
        var self = this;
        var el = self.element;

        var hideStorage = lidraughts.storage.make('friends-hide');
        var $friendBoxTitle = el.find('.friend_box_title').click(function() {
          var show = hideStorage.get() == 1;
          el.find('.content_wrap').toggleNone(show);
          if (show) hideStorage.remove();
          else hideStorage.set(1);
        });
        if (hideStorage.get() == 1) el.find('.content_wrap').addClass('none');

        self.$nbOnline = $friendBoxTitle.find('.online');
        self.$nobody = el.find(".nobody");

        function dataList(name) { return el.data(name) ? el.data(name).split(',') : []; }
        self.set(
          dataList('preload'),
          dataList('playing'),
          dataList('studying'),
          dataList('patrons'));
      },
      repaint: function() {
        lidraughts.raf(function() {
          var ids = Object.keys(this.users).sort();
          this.$nbOnline.text(ids.length);
          this.$nobody.toggleNone(!ids.length);
          this.element.find('div.list').replaceWith(
            $('<div class="content list"></div>').append(ids.map(function(id) {
              return renderUser(this.users[id]);
            }.bind(this)))
          );
        }.bind(this));
      },
      insert: function(titleName) {
        var id = getId(titleName);
        if (!this.users[id]) this.users[id] = makeUser(titleName);
        return this.users[id];
      },
      set: function(online, playing, studying, patrons) {
        this.users = {};
        for (i in online) this.insert(online[i]);
        for (i in playing) this.insert(playing[i]).playing = true;
        for (i in studying) this.insert(studying[i]).studying = true;
        for (i in patrons) this.insert(patrons[i]).patron = true;
        this.repaint();
      },
      enters: function(titleName, playing, studying, patron) {
        var user = this.insert(titleName);
        user.playing = playing;
        user.studying = studying;
        user.patron = patron;
        this.repaint();
      },
      leaves: function(titleName) {
        delete this.users[getId(titleName)];
        this.repaint();
      },
      playing: function(titleName) {
        this.insert(titleName).playing = true;
        this.repaint();
      },
      stopped_playing: function(titleName) {
        this.insert(titleName).playing = false;
        this.repaint();
      },
      study_join: function(titleName) {
        this.insert(titleName).studying = true;
        this.repaint();
      },
      study_leave: function(titleName) {
        this.insert(titleName).studying = false;
        this.repaint();
      }
    };
  })());

  lidraughts.widget("clock", {
    _create: function() {
      var self = this;
      // this.options.time: seconds Integer
      var target = this.options.time * 1000 + Date.now();
      var timeEl = this.element.find('.time')[0];
      var tick = function() {
        var remaining = target - Date.now();
        if (remaining <= 0) clearInterval(self.interval);
        timeEl.innerHTML = self._formatMs(remaining);
      };
      this.interval = setInterval(tick, 1000);
      tick();
    },

    _pad: function(x) { return (x < 10 ? '0' : '') + x; },

    _formatMs: function(msTime) {
      var date = new Date(Math.max(0, msTime + 500));

      var hours = date.getUTCHours(),
        minutes = date.getUTCMinutes(),
        seconds = date.getUTCSeconds();

      if (hours > 0) {
        return hours + ':' + this._pad(minutes) + ':' + this._pad(seconds);
      } else {
        return minutes + ':' + this._pad(seconds);
      }
    }
  });

  $(function() {
    lidraughts.pubsub.on('content_loaded', lidraughts.parseFen);

    var socketOpened = false;

    function startWatching() {
      if (!socketOpened) return;
      var ids = [];
      $('.mini-board.live').removeClass("live").each(function() {
        ids.push(this.getAttribute("data-live"));
      });
      if (ids.length) lidraughts.socket.send("startWatching", ids.join(" "));
    }
    lidraughts.pubsub.on('content_loaded', startWatching);
    lidraughts.pubsub.on('socket.open', function() {
      socketOpened = true;
      startWatching();
    });

    lidraughts.requestIdleCallback(function() {
      lidraughts.parseFen();
      $('.chat__members').watchers();
      if (location.hash === '#enable-blind-mode' && !$('body').hasClass('blind-mode'))
        $.post('/toggle-blind-mode', { enable: 1, redirect: '/' }, lidraughts.reload);
    });
  });

  ///////////////////
  // tournament.js //
  ///////////////////

  function startTournament(cfg) {
    var element = document.querySelector('main.tour');
    $('body').data('tournament-id', cfg.data.id);
    var tournament;
    lidraughts.socket = lidraughts.StrongSocket(
      '/tournament/' + cfg.data.id + '/socket/v3', cfg.data.socketVersion, {
        receive: function(t, d) {
          return tournament.socketReceive(t, d);
        }
      });
    cfg.socketSend = lidraughts.socket.send;
    cfg.element = element;
    cfg.$side = $('.tour__side').clone();
    cfg.$faq = $('.tour__faq').clone();
    tournament = LidraughtsTournament.start(cfg);
  };

  function startSimul(cfg) {
    cfg.element = document.querySelector('main.simul');
    $('body').data('simul-id', cfg.data.id);
    var simul;
    lidraughts.socket = lidraughts.StrongSocket(
      '/simul/' + cfg.data.id + '/socket/v4', cfg.socketVersion, {
        receive: function(t, d) {
          simul.socketReceive(t, d);
        }
      });
    cfg.socketSend = lidraughts.socket.send;
    cfg.$side = $('.simul__side').clone();
    simul = LidraughtsSimul(cfg);
  }

  ////////////////
  // user_analysis.js //
  ////////////////

  function startUserAnalysis(cfg) {
    var analyse;
    cfg.initialPly = 'url';
    cfg.trans = lidraughts.trans(cfg.i18n);
    lidraughts.socket = lidraughts.StrongSocket('/analysis/socket/v3', false, {
      receive: function(t, d) {
        analyse.socketReceive(t, d);
      }
    });
    cfg.socketSend = lidraughts.socket.send;
    cfg.$side = $('.analyse__side').clone();
    analyse = LidraughtsAnalyse.start(cfg);
  }

  ////////////////
  // study.js //
  ////////////////

  function startStudy(cfg) {
    var analyse;
    cfg.initialPly = 'url';
    lidraughts.socket = lidraughts.StrongSocket(cfg.socketUrl, cfg.socketVersion, {
      receive: function(t, d) {
        analyse.socketReceive(t, d);
      }
    });
    cfg.socketSend = lidraughts.socket.send;
    cfg.trans = lidraughts.trans(cfg.i18n);
    analyse = LidraughtsAnalyse.start(cfg);
  }

  ////////////////
  // practice.js //
  ////////////////

  function startPractice(cfg) {
    var analyse;
    cfg.trans = lidraughts.trans(cfg.i18n);
    lidraughts.socket = lidraughts.StrongSocket('/analysis/socket/v3', false, {
      receive: function(t, d) {
        analyse.socketReceive(t, d);
      }
    });
    cfg.socketSend = lidraughts.socket.send;
    analyse = LidraughtsAnalyse.start(cfg);
  }

  ////////////////
  // relay.js //
  ////////////////

  function startRelay(cfg) {
    var analyse;
    cfg.initialPly = 'url';
    lidraughts.socket = lidraughts.StrongSocket(cfg.socketUrl, cfg.socketVersion, {
      receive: function(t, d) {
        analyse.socketReceive(t, d);
      }
    });
    cfg.socketSend = lidraughts.socket.send;
    cfg.trans = lidraughts.trans(cfg.i18n);
    analyse = LidraughtsAnalyse.start(cfg);
  }

  ////////////////
  // puzzle.js //
  ////////////////

  function startPuzzle(cfg) {
    var puzzle;
    cfg.element = document.querySelector('main.puzzle');
    lidraughts.socket = lidraughts.StrongSocket('/socket/v3', false, {
      receive: function(t, d) {
        puzzle.socketReceive(t, d);
      }
    });
    cfg.socketSend = lidraughts.socket.send;
    puzzle = LidraughtsPuzzle.default(cfg);
  }
})();
