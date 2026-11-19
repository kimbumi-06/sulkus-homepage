import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { RefreshCw, Upload } from 'lucide-react';
import { db } from './firebase';
import { callSync } from './api';

const STEP_LABEL = {
  bgg: 'BGG에서 가져오기',
  terms: '장르·메커니즘 번역',
  names: '제목 번역',
  descriptions: '설명 번역',
  publish: '사이트에 반영',
  done: '완료',
};

const formatTime = (ts) => (ts?.toDate ? ts.toDate().toLocaleString('ko-KR') : '');

/**
 * publishState: '', 'waiting', 'publishing', 'done', 'error' (운영진 수정 후 자동 반영 상태)
 */
function SyncPanel({ publishState, publishError, onSynced }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(
    () => onSnapshot(doc(db, 'sync', 'status'), (snap) => setStatus(snap.data() ?? null)),
    []
  );

  const running = status?.state === 'running' || starting;

  const start = async () => {
    if (!window.confirm('BGG에서 목록을 새로 가져오고, 번역 안 된 것을 AI로 번역해서 사이트 데이터를 덮어써요. 진행할까요?')) return;
    setError('');
    setStarting(true);
    try {
      await callSync();
      onSynced?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  };

  const percent = status?.total ? Math.round((status.done / status.total) * 100) : 0;

  return (
    <section className="sync">
      <div className="sync__row">
        <button type="button" className="admin__btn" onClick={start} disabled={running}>
          <RefreshCw size={15} strokeWidth={1.75} className={running ? 'sync__spin' : ''} />
          {running ? '동기화 중…' : 'BGG에서 가져와서 번역 + 반영'}
        </button>

        <span className="sync__publish">
          <Upload size={14} strokeWidth={1.75} />
          {publishState === 'waiting' && '수정 내용 반영 대기 중…'}
          {publishState === 'publishing' && '수정 내용 사이트에 반영 중…'}
          {publishState === 'done' && '수정 내용이 사이트에 반영됐어요.'}
          {publishState === 'error' && `반영 실패: ${publishError}`}
          {!publishState && '수정하면 몇 초 뒤 자동으로 사이트에 반영돼요.'}
        </span>
      </div>

      {status && (
        <div className={`sync__status sync__status--${status.state}`}>
          {status.state === 'running' && (
            <>
              <div className="sync__bar">
                <span style={{ width: `${percent}%` }} />
              </div>
              <p>
                {STEP_LABEL[status.step] || status.step} · {status.message}
              </p>
            </>
          )}
          {status.state === 'done' && (
            <p>마지막 동기화: {formatTime(status.finishedAt)} ({status.by}) · {status.message}</p>
          )}
          {status.state === 'error' && (
            <p>
              동기화 실패 ({formatTime(status.finishedAt)}): {status.error}
            </p>
          )}
        </div>
      )}
      {error && <p className="sync__error">{error}</p>}
    </section>
  );
}

export default SyncPanel;
