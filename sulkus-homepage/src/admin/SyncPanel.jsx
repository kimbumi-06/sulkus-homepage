import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Upload } from 'lucide-react';
import { callAdmin } from './api';

const STEP_LABEL = {
  collection: 'BGG 컬렉션',
  things: 'BGG 게임 정보',
  merge: '시트 정리',
  terms: '장르·메커니즘 번역',
  names: '제목 번역',
  descriptions: '설명 번역',
  publish: '사이트에 반영',
  done: '완료',
};

const formatTime = (v) => (v ? new Date(v).toLocaleString('ko-KR') : '');

/** 동기화(BGG 가져오기 + 번역 + 반영) / 지금 반영 버튼 + 진행 상황 */
function SyncPanel({ onChanged }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    try {
      setStatus(await callAdmin('status'));
    } catch {
      // 상태 확인 실패는 다음 확인 때 다시
    }
  }, []);

  // 처음 한 번 상태 불러오기
  useEffect(() => {
    let cancelled = false;
    callAdmin('status')
      .then((s) => !cancelled && setStatus(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const running = status?.job?.state === 'running';

  // 동기화 중엔 5초마다 진행 상황 확인, 끝나면 데이터 새로 불러오기
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [running, refresh]);

  const [wasRunning, setWasRunning] = useState(false);
  if (running !== wasRunning) {
    setWasRunning(running);
    if (wasRunning && !running) onChanged?.();
  }

  const run = async (action) => {
    if (action === 'sync' && !window.confirm(
      'BGG에서 목록을 새로 가져오고, 번역 안 된 것을 AI로 번역해서 사이트 데이터를 덮어써요.\n처음엔 몇 분 걸리고, 창을 닫아도 계속 진행돼요. 진행할까요?'
    )) return;
    setBusy(action);
    setMessage('');
    try {
      const res = await callAdmin(action);
      setStatus(res);
      if (action === 'publish') {
        setMessage(`게임 ${res.count}개를 사이트에 반영했어요.`);
        onChanged?.();
      }
      // 게임이 적으면 첫 요청 안에 동기화가 끝남
      if (action === 'sync' && res.job?.state === 'done') onChanged?.();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy('');
    }
  };

  const job = status?.job;
  const percent = job?.total ? Math.round((job.done / job.total) * 100) : 0;

  return (
    <section className="sync">
      <div className="sync__row">
        <button type="button" className="admin__btn" onClick={() => run('sync')} disabled={running || !!busy}>
          <RefreshCw size={15} strokeWidth={1.75} className={running || busy === 'sync' ? 'sync__spin' : ''} />
          {running ? '동기화 중…' : 'BGG 동기화 (가져오기 + 번역 + 반영)'}
        </button>
        <button
          type="button"
          className="admin__btn admin__btn--ghost"
          onClick={() => run('publish')}
          disabled={running || !!busy}
        >
          <Upload size={15} strokeWidth={1.75} />
          {busy === 'publish' ? '반영 중…' : '시트 수정 내용 지금 반영'}
        </button>
        <span className="sync__publish">
          {status?.pendingEdits
            ? '반영 안 된 시트 수정이 있어요 (동기화가 끝나면 같이 반영)'
            : `마지막 반영: ${formatTime(status?.publishedAt) || '없음'}`}
        </span>
      </div>

      {job && (
        <div className={`sync__status sync__status--${job.state}`}>
          {job.state === 'running' && (
            <>
              <div className="sync__bar">
                <span style={{ width: `${percent}%` }} />
              </div>
              <p>
                {STEP_LABEL[job.step] || job.step} · {job.message}
              </p>
            </>
          )}
          {job.state === 'done' && (
            <p>
              마지막 동기화: {formatTime(job.finishedAt)} ({job.by}) · {job.message}
            </p>
          )}
          {job.state === 'error' && (
            <p>
              동기화 실패 ({formatTime(job.finishedAt)}): {job.error}
            </p>
          )}
        </div>
      )}
      {message && <p className="sync__error">{message}</p>}
    </section>
  );
}

export default SyncPanel;
