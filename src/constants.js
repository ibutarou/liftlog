(function (root) {
  'use strict';

  const BODY_PARTS = [
    {
      id: 'chest',
      label: '胸',
      color: '#4f46e5',
      presets: ['ベンチプレス', 'インクラインダンベルプレス', 'ダンベルフライ', 'ディップス'],
    },
    {
      id: 'back',
      label: '背中',
      color: '#0ea5e9',
      presets: ['懸垂（チンニング）', 'ラットプルダウン', 'ベントオーバーロウ', 'シーテッドロウ', 'デッドリフト'],
    },
    {
      id: 'legs',
      label: '脚',
      color: '#10b981',
      presets: ['スクワット', 'レッグプレス', 'ルーマニアンデッドリフト', 'ブルガリアンスクワット', 'レッグエクステンション'],
    },
    {
      id: 'shoulders',
      label: '肩',
      color: '#f59e0b',
      presets: ['ショルダープレス', 'サイドレイズ', 'リアデルトフライ', 'フロントレイズ'],
    },
    {
      id: 'arms',
      label: '腕',
      color: '#ec4899',
      presets: ['バーベルカール', 'ダンベルカール', 'トライセプスプレスダウン', 'フレンチプレス'],
    },
    {
      id: 'core',
      label: '体幹/腹筋',
      color: '#8b5cf6',
      presets: ['アブローラー', 'ハンギングレッグレイズ', 'ケーブルクランチ', 'プランク'],
    },
  ];

  const BODY_PART_MAP = BODY_PARTS.reduce((acc, part) => {
    acc[part.id] = part;
    return acc;
  }, {});

  const PERIOD_OPTIONS = [
    { value: 7, label: '直近7日' },
    { value: 14, label: '直近14日' },
    { value: 30, label: '直近30日' },
    { value: 'all', label: '全期間' },
  ];

  const STORAGE_KEYS = {
    workouts: 'liftlog_workouts_v1',
    meta: 'liftlog_meta_v1',
    theme: 'liftlog_theme_v1',
  };

  const api = {
    BODY_PARTS,
    BODY_PART_MAP,
    PERIOD_OPTIONS,
    STORAGE_KEYS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LiftLog = root.LiftLog || {};
  root.LiftLog.Constants = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
