(function (root) {
  'use strict';

  const Calculations =
    typeof module !== 'undefined' && module.exports
      ? require('./calculations.js')
      : root.LiftLog.Calculations;

  const { formatLocalDate } = Calculations;

  function dateOffset(referenceDate, daysAgo) {
    const base = referenceDate instanceof Date ? referenceDate : new Date(referenceDate || Date.now());
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    d.setDate(d.getDate() - daysAgo);
    return formatLocalDate(d);
  }

  /**
   * Creates realistic sample workout records over the past ~33 days.
   * Designed so:
   * - Exercises show progressive 1RM/volume growth and multiple PR milestones
   * - Period filters (7 / 14 / 30 / all) display distinct body-part balance & advice
   */
  function createSampleWorkouts(referenceDate) {
    const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate || Date.now());

    const rawEntries = [
      // ~26-33 days ago (included in 30日 / 全期間, includes legs & core)
      { daysAgo: 32, bodyPart: 'chest', exerciseName: 'ベンチプレス', weight: 62.5, reps: 8, sets: 3, memo: 'フォーム確認を重視' },
      { daysAgo: 32, bodyPart: 'shoulders', exerciseName: 'サイドレイズ', weight: 8, reps: 15, sets: 3, memo: '' },
      { daysAgo: 30, bodyPart: 'legs', exerciseName: 'スクワット', weight: 80, reps: 8, sets: 4, memo: 'ボトムでしっかり粘る' },
      { daysAgo: 30, bodyPart: 'core', exerciseName: 'アブローラー', weight: 10, reps: 12, sets: 3, memo: '膝コロ、腹筋に効いた' },
      { daysAgo: 28, bodyPart: 'back', exerciseName: 'ラットプルダウン', weight: 50, reps: 10, sets: 3, memo: '' },
      { daysAgo: 28, bodyPart: 'arms', exerciseName: 'ダンベルカール', weight: 10, reps: 12, sets: 3, memo: '反動を使わない' },

      // ~18-25 days ago (included in 30日)
      { daysAgo: 25, bodyPart: 'chest', exerciseName: 'ベンチプレス', weight: 65, reps: 8, sets: 3, memo: '前回より2.5kgアップ！' },
      { daysAgo: 25, bodyPart: 'chest', exerciseName: 'インクラインダンベルプレス', weight: 20, reps: 10, sets: 3, memo: '' },
      { daysAgo: 23, bodyPart: 'legs', exerciseName: 'スクワット', weight: 85, reps: 8, sets: 4, memo: '自己ベスト更新の手応え' },
      { daysAgo: 23, bodyPart: 'legs', exerciseName: 'レッグプレス', weight: 120, reps: 12, sets: 3, memo: '' },
      { daysAgo: 21, bodyPart: 'back', exerciseName: 'ラットプルダウン', weight: 55, reps: 10, sets: 3, memo: '肩甲骨を下げる意識' },
      { daysAgo: 21, bodyPart: 'shoulders', exerciseName: 'ショルダープレス', weight: 16, reps: 10, sets: 3, memo: '' },
      { daysAgo: 19, bodyPart: 'core', exerciseName: 'ハンギングレッグレイズ', weight: 10, reps: 12, sets: 3, memo: '自重+意識' },
      { daysAgo: 18, bodyPart: 'chest', exerciseName: 'ベンチプレス', weight: 67.5, reps: 8, sets: 3, memo: '8レップ安定してきた' },

      // ~8-14 days ago (included in 14日 / 30日 — upper-body heavy, core = 0)
      { daysAgo: 13, bodyPart: 'chest', exerciseName: 'ベンチプレス', weight: 70, reps: 7, sets: 3, memo: '70kg到達！ラスト1回粘った' },
      { daysAgo: 13, bodyPart: 'arms', exerciseName: 'トライセプスプレスダウン', weight: 22.5, reps: 12, sets: 3, memo: '' },
      { daysAgo: 11, bodyPart: 'back', exerciseName: 'ラットプルダウン', weight: 57.5, reps: 10, sets: 4, memo: '背中全体に強い刺激' },
      { daysAgo: 11, bodyPart: 'back', exerciseName: 'シーテッドロウ', weight: 50, reps: 10, sets: 3, memo: '' },
      { daysAgo: 10, bodyPart: 'shoulders', exerciseName: 'ショルダープレス', weight: 18, reps: 10, sets: 3, memo: '安定して挙げられた' },
      { daysAgo: 10, bodyPart: 'shoulders', exerciseName: 'サイドレイズ', weight: 9, reps: 15, sets: 4, memo: '' },
      { daysAgo: 8, bodyPart: 'legs', exerciseName: 'スクワット', weight: 90, reps: 8, sets: 3, memo: '90kgクリア！' },

      // ~0-6 days ago (included in 7日 / 14日 — chest & arms heavy, legs & core neglected)
      { daysAgo: 6, bodyPart: 'chest', exerciseName: 'ベンチプレス', weight: 70, reps: 9, sets: 3, memo: '回数伸びて1RM更新' },
      { daysAgo: 6, bodyPart: 'chest', exerciseName: 'インクラインダンベルプレス', weight: 22, reps: 10, sets: 3, memo: '上部にもよく入った' },
      { daysAgo: 5, bodyPart: 'back', exerciseName: '懸垂（チンニング）', weight: 65, reps: 8, sets: 3, memo: '体重相当で記録' },
      { daysAgo: 4, bodyPart: 'arms', exerciseName: 'ダンベルカール', weight: 12, reps: 10, sets: 3, memo: '重量アップ' },
      { daysAgo: 3, bodyPart: 'chest', exerciseName: 'ベンチプレス', weight: 72.5, reps: 8, sets: 3, memo: '72.5kg×8達成！絶好調' },
      { daysAgo: 3, bodyPart: 'shoulders', exerciseName: 'ショルダープレス', weight: 20, reps: 9, sets: 3, memo: '20kg突入' },
      { daysAgo: 1, bodyPart: 'chest', exerciseName: 'ダンベルフライ', weight: 14, reps: 12, sets: 4, memo: 'ストレッチ重視でパンプ' },
      { daysAgo: 1, bodyPart: 'back', exerciseName: 'ラットプルダウン', weight: 60, reps: 10, sets: 3, memo: '60kgクリーンに引けた' },
    ];

    const baseTime = ref.getTime();
    return rawEntries.map((entry, idx) => ({
      id: `sample_${idx + 1}`,
      date: dateOffset(ref, entry.daysAgo),
      bodyPart: entry.bodyPart,
      exerciseName: entry.exerciseName,
      weight: entry.weight,
      reps: entry.reps,
      sets: entry.sets,
      memo: entry.memo,
      createdAt: baseTime - entry.daysAgo * 86400000 + idx * 1000,
    }));
  }

  const api = {
    createSampleWorkouts,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LiftLog = root.LiftLog || {};
  root.LiftLog.SampleData = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
