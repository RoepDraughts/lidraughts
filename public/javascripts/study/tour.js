function loadShepherd(f) {
  var theme = 'shepherd-theme-' + ($('body').hasClass('dark') ? 'default' : 'dark');
  lidraughts.loadCss('vendor/shepherd/dist/css/' + theme + '.css');
  lidraughts.loadCss('stylesheets/shepherd.css');
  lidraughts.loadScript('vendor/shepherd/dist/js/tether.js', {noVersion:true}).done(function() {
    lidraughts.loadScript('vendor/shepherd/dist/js/shepherd.min.js', {noVersion:true}).done(function() {
      f(theme);
    });
  });
};
lidraughts.studyTour = function(study) {
  loadShepherd(function(theme) {
    var onTab = function(tab) {
      return {
        'before-show': function() {
          study.setTab(tab);
        }
      };
    };
    var tour = new Shepherd.Tour({
      defaults: {
        classes: theme,
        scrollTo: false,
        showCancelLink: true
      }
    });
    [
      {
        title: "Welcome to lidraughts study!",
        text: "This is a shared analysis board.<br><br>" +
          "Use it to analyse and annotate games,<br>" +
          "discuss positions with friends,<br>" +
          "and of course for draughts lessons!<br><br>" +
          "It's a powerful tool, let's take some time to see how it works.",
        attachTo: "main.analyse .study__buttons .help top"
      }, {
        title: "Shared and saved",
        text: "Other members can see your moves in real time!<br>" +
          "Plus, everything is saved forever.",
        attachTo: "main.analyse .areplay left"
      }, {
        title: "Study members",
        text: "<i data-icon='v'></i> Spectators can view the study and talk in the chat.<br>" +
          "<br><i data-icon='r'></i> Contributors can make moves and update the study.",
        attachTo: ".study__members right",
        when: onTab('members')
      },
      study.isOwner ? {
        title: "Invite members",
        text: "By clicking the <i data-icon='O'></i> button.<br>" +
        "Then decide who can contribute or not.",
        attachTo: ".study__members .add right",
        when: onTab('members')
      } : null, {
        title: "Study chapters",
        text: "A study can contain several chapters.<br>" +
        "Each chapter has a distinct initial position and move tree.",
        attachTo: ".study__chapters right",
        when: onTab('chapters')
      },
      study.isContrib ? {
        title: "Create new chapters",
        text: "By clicking the <i data-icon='O'></i> button.",
        attachTo: ".study__chapters .add right",
        when: onTab('chapters')
      } : null, study.isContrib ? {
        title: "Comment on a position",
        text: "With the <i data-icon='c'></i> button, or a right click on the move list on the right.<br>" +
          "Comments are shared and persisted.",
        attachTo: ".study__buttons .left-buttons .comments top"
      } : null, study.isContrib ? {
        title: "Annotate a position",
        text: "With the !? button, or a right click on the move list on the right.<br>" +
          "Annotation glyphs are shared and persisted.",
        attachTo: ".study__buttons .left-buttons .glyphs top"
      } : null, {
        title: "Thanks for your time",
        text: "You can find your <a href='/study/mine/hot'>previous studies</a> from your profile page.<br>" +
          "Power users might want to press \"?\" to see the keyboard shortcuts.<br>" +
          "Have fun!",
        buttons: [{
          text: 'Done',
          action: tour.next
        }],
        attachTo: "main.analyse .study__buttons .help top"
      }
    ].filter(function(v) {
      return v;
    }).forEach(function(s) {
      tour.addStep(s.title, s);
    });
    tour.start();
  });
};
