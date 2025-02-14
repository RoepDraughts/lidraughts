import { empty } from 'common';
import { h } from 'snabbdom'
import { VNode } from 'snabbdom/vnode'
import { Hooks } from 'snabbdom/hooks'
import { MaybeVNodes } from './interfaces';
import { AutoplayDelay } from './autoplay';
import { boolSetting, BoolSetting } from './boolSetting';
import AnalyseCtrl from './ctrl';
import { cont as contRoute } from 'game/router';
import { bind, dataIcon } from './util';
import * as pdnExport from './pdnExport';

interface AutoplaySpeed {
  name: string;
  delay: AutoplayDelay;
}

const baseSpeeds: AutoplaySpeed[] = [{
  name: 'fast',
  delay: 1000
}, {
  name: 'slow',
  delay: 5000
}];

const realtimeSpeed: AutoplaySpeed = {
  name: 'realtimeReplay',
  delay: 'realtime'
};

const cplSpeed: AutoplaySpeed = {
  name: 'byCPL',
  delay: 'cpl'
};

function deleteButton(ctrl: AnalyseCtrl, userId: string | null): VNode | undefined {
  const g = ctrl.data.game;
  if (g.source === 'import' &&
    g.importedBy && g.importedBy === userId)
    return h('form.delete', {
      attrs: {
        method: 'post',
        action: '/' + g.id + '/delete'
      },
      hook: bind('submit', _ => confirm(ctrl.trans.noarg('deleteThisImportedGame')))
    }, [
      h('button.button.text.thin', {
        attrs: {
          type: 'submit',
          'data-icon': 'q'
        }
      }, ctrl.trans.noarg('delete'))
    ]);
  return;
}

function autoplayButtons(ctrl: AnalyseCtrl): VNode {
  const d = ctrl.data;
  const speeds = [
    ...baseSpeeds,
    ...(d.game.speed !== 'correspondence' && !empty(d.game.moveCentis) ? [realtimeSpeed] : []),
    ...(d.analysis ? [cplSpeed] : [])
  ];
  return h('div.autoplay', speeds.map(speed => {
    return h('a.button.button-empty', {
      hook: bind('click', () => ctrl.togglePlay(speed.delay), ctrl.redraw)
    }, ctrl.trans.noarg(speed.name));
  }));
}

function rangeConfig(read: () => number, write: (value: number) => void): Hooks {
  return {
    insert: vnode => {
      const el = vnode.elm as HTMLInputElement;
      el.value = '' + read();
      el.addEventListener('input', _ => write(parseInt(el.value)));
      el.addEventListener('mouseout', _ => el.blur());
    }
  };
}

function formatHashSize(v: number): string {
  if (v < 1000) return v + 'MB';
  else return Math.round(v / 1024) + 'GB';
}

function hiddenInput(name: string, value: string) {
  return h('input', {
    attrs: { 'type': 'hidden', name, value }
  });
}

function studyButton(ctrl: AnalyseCtrl) {
  if (ctrl.study && ctrl.embed && !ctrl.ongoing) return h('a.button.button-empty', {
    attrs: {
      href: '/study/' + ctrl.study.data.id + '#' + ctrl.study.currentChapter().id,
      target: '_blank',
      'data-icon': '4'
    }
  }, ctrl.trans.noarg('openStudy'));
  if (ctrl.study || ctrl.ongoing || ctrl.embed) return;
  return h('form', {
    attrs: {
      method: 'post',
      action: '/study/as'
    },
    hook: bind('submit', e => {
      const pdnInput = (e.target as HTMLElement).querySelector('input[name=pdn]') as HTMLInputElement;
      if (pdnInput) pdnInput.value = pdnExport.renderFullTxt(ctrl);
    })
  }, [
    !ctrl.synthetic ? hiddenInput('gameId', ctrl.data.game.id) : hiddenInput('pdn', ''),
    hiddenInput('orientation', ctrl.draughtsground.state.orientation),
    hiddenInput('variant', ctrl.data.game.variant.key),
    hiddenInput('fen', ctrl.tree.root.fen),
    h('button.button.button-empty', {
      attrs: {
        type: 'submit',
        'data-icon': '4'
      }
    }, ctrl.trans.noarg('toStudy'))
  ]);
}

function puzzleIcon(ctrl: AnalyseCtrl) {
  return ctrl.data.game.variant.key === 'frisian' ? '' : (ctrl.data.game.variant.key === 'russian' ? '' : '-');
}

function puzzleEditorButton(ctrl: AnalyseCtrl) {
  if (ctrl.ongoing) return;
  return h('form', {
    attrs: {
      method: 'post',
      action: '/analysis/puzzle/pdn'
    },
    hook: bind('submit', e => {
      const pdnInput = (e.target as HTMLElement).querySelector('input[name=pdn]') as HTMLInputElement;
      if (pdnInput) pdnInput.value = pdnExport.renderFullTxt(ctrl, true);
    })
  }, [
    hiddenInput('pdn', ''),
    h('button.button.button-empty', {
      attrs: {
        type: 'submit',
        'data-icon': puzzleIcon(ctrl)
      }
    }, 'Puzzle editor')
  ]);
}

export class Ctrl {
  open: boolean = false;
  toggle = () => this.open = !this.open;
}

export function view(ctrl: AnalyseCtrl): VNode {
  const d = ctrl.data,
    noarg = ctrl.trans.noarg,
    isOngoing = ctrl.ongoing || (ctrl.study && ctrl.study.isInternalRelay()),
    canContinue = !isOngoing && !ctrl.embed && !d.puzzleEditor && (d.game.variant.key === 'standard' || d.game.variant.key === 'russian' || d.game.variant.key === 'brazilian'),
    canPuzzleEditor = !d.puzzleEditor && d.toPuzzleEditor && (d.game.variant.key === 'standard' || d.game.variant.key === 'frisian' || d.game.variant.key === 'russian'),
    ceval = ctrl.getCeval(),
    mandatoryCeval = ctrl.mandatoryCeval();

  const tools: MaybeVNodes = [
    h('div.action-menu__tools', [
      h('a.button.button-empty', {
        hook: bind('click', ctrl.flip),
        attrs: dataIcon('B')
      }, noarg('flipBoard')),
      isOngoing ? null : h('a.button.button-empty', {
        attrs: {
          href: (d.userAnalysis ? '/editor?fen=' + ctrl.node.fen : '/' + d.game.id + '/edit?fen=' + ctrl.node.fen) + (d.game.variant.key !== 'standard' ? "&variant=" + d.game.variant.key : ''),
          rel: 'nofollow',
          target: ctrl.embed ? '_blank' : '',
          'data-icon': 'm'
        }
      }, noarg('boardEditor')),
      canContinue ? h('a.button.button-empty', {
        hook: bind('click', _ => $.modal($('.continue-with.g_' + d.game.id))),
         attrs: dataIcon('U')
        }, noarg('continueFromHere')) : null,
      !d.puzzleEditor ? studyButton(ctrl) : null,
      canPuzzleEditor ? puzzleEditorButton(ctrl) : null
    ])
  ];

  function missingAlts(node: Tree.Node): boolean {
    if (node.missingAlts && node.missingAlts.length > 0)
      return true;
    for (const child of node.children) {
      if (missingAlts(child))
        return true;
    }
    return false;
  }

  const puzzleTools: MaybeVNodes = [
    h('h2', 'Puzzle editor'),
    h('div.action-menu__tools', [
      h('a.button.button-empty', {
        hook: bind('click', () => {
          if (missingAlts(ctrl.tree.root))
            alert('There are missing alternative solutions! Click \'Expand alternatives\' for all moves marked in red and try submitting again.');
          else $.ajax({
            url: '/training/api/puzzle?variant=' + (d.game.variant.key === 'fromPosition' ? 'standard' : d.game.variant.key),
            method: 'POST',
            data: ctrl.generatePuzzleJson(),
            dataType: 'text',
            contentType: 'application/json; charset=utf-8',
            success: function (response) { alert('success: ' + response.toString().replace('https:', 'http:')); },
            error: function (response) { alert('error: ' + JSON.stringify(response)); }
          })
        }),
        attrs: dataIcon(puzzleIcon(ctrl))
      }, 'Submit puzzle')
    ])
  ];

  const cevalConfig: MaybeVNodes = (ceval && ceval.possible && ceval.allowed()) ? ([
    h('h2', noarg('computerAnalysis'))
  ] as MaybeVNodes).concat([
    ctrlBoolSetting({
      name: 'enable',
      title: (
        mandatoryCeval ? "Required by practice mode" : window.lidraughts.engineName
      ) + ' (Hotkey: z)',
      id: 'all',
      checked: ctrl.showComputer(),
      disabled: mandatoryCeval,
      change: ctrl.toggleComputer
    }, ctrl)
  ]).concat(
    ctrl.showComputer() ? [
      ctrlBoolSetting({
        name: 'bestMoveArrow',
        title: 'Hotkey: a',
        id: 'shapes',
        checked: ctrl.showAutoShapes(),
        change: ctrl.toggleAutoShapes
      }, ctrl),
      ctrlBoolSetting({
        name: 'evaluationGauge',
        id: 'gauge',
        checked: ctrl.showGauge(),
        change: ctrl.toggleGauge
      }, ctrl),
      ctrlBoolSetting({
        name: 'infiniteAnalysis',
        title: 'removesTheDepthLimit',
        id: 'infinite',
        checked: ceval.infinite(),
        change: ctrl.cevalSetInfinite
      }, ctrl),
      /*(id => {
        const max = 5;
        return h('div.setting', [
          h('label', { attrs: { 'for': id } }, noarg('multipleLines')),
          h('input#' + id, {
            attrs: {
              type: 'range',
              min: 1,
              max,
              step: 1
            },
            hook: rangeConfig(
              () => parseInt(ceval!.multiPv()),
              ctrl.cevalSetMultiPv)
          }),
          h('div.range_value', ceval.multiPv() + ' / ' + max)
        ]);
      })('analyse-multipv'),*/
      ceval.pnaclSupported ? (id => {
        let max = navigator.hardwareConcurrency;
        if (!max) return;
        if (max > 2) max--; // don't overload your computer, you dummy
        return h('div.setting', [
          h('label', { attrs: { 'for': id } }, noarg('cpus')),
          h('input#' + id, {
            attrs: {
              type: 'range',
              min: 1,
              max,
              step: 1
            },
            hook: rangeConfig(
              () => parseInt(ceval!.threads()),
              ctrl.cevalSetThreads)
          }),
          h('div.range_value', ceval.threads() + ' / ' + max)
        ]);
      })('analyse-threads') : null,
      ceval.pnaclSupported ? (id => h('div.setting', [
        h('label', { attrs: { 'for': id } }, noarg('memory')),
        h('input#' + id, {
          attrs: {
            type: 'range',
            min: 4,
            max: 10,
            step: 1
          },
          hook: rangeConfig(
            () => Math.floor(Math.log2!(parseInt(ceval!.hashSize()))),
            v => ctrl.cevalSetHashSize(Math.pow(2, v)))
        }),
        h('div.range_value', formatHashSize(parseInt(ceval.hashSize())))
      ]))('analyse-memory') : null
    ] : []) : [];

  const notationConfig = [
    ctrlBoolSetting({
      name: noarg('inlineNotation'),
      title: 'Shift+I',
      id: 'inline',
      checked: ctrl.treeView.inline(),
      change(v) {
        ctrl.treeView.set(v);
        ctrl.actionMenu.toggle();
      }
    }, ctrl)
  ];

  const playWithMachineAttrs = function() {
    let attrs : any = {
      rel: 'nofollow'
    };
    if (d.game.variant.key === 'standard') {
      attrs.href = d.userAnalysis ? '/?fen=' + ctrl.encodeNodeFen() + '#ai' : contRoute(d, 'ai') + '?fen=' + ctrl.node.fen;
    }
    return attrs;
  }

  const standardTools = tools.concat(notationConfig);
  return h('div.action-menu',
    (d.puzzleEditor ? standardTools.concat(puzzleTools) : standardTools)
      .concat(cevalConfig)
      .concat(ctrl.mainline.length > 4 ? [h('h2', noarg('replayMode')), autoplayButtons(ctrl)] : [])
      .concat([
        deleteButton(ctrl, ctrl.opts.userId),
        canContinue ? h('div.continue-with.none.g_' + d.game.id, [
          h('a.button' + (d.game.variant.key === 'standard' ? '' : '.disabled'), {
            attrs: playWithMachineAttrs()
          }, noarg('playWithTheMachine')),
          h('a.button', {
            attrs: {
              href: d.userAnalysis ? 
                '/?fen=' + ctrl.encodeNodeFen() + '&variant=' + d.game.variant.key + '#friend' : 
                contRoute(d, 'friend') + '?fen=' + ctrl.node.fen,
              rel: 'nofollow'
            }
          }, noarg('playWithAFriend'))
        ]) : null
      ])
  );
}

function ctrlBoolSetting(o: BoolSetting, ctrl: AnalyseCtrl) {
  return boolSetting(o, ctrl.trans, ctrl.redraw);
}
