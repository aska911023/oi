export default function Loading() {
  return (
    <div className="loading-screen">
      <div className="loading-inner">
        <div className="ou-mark" aria-hidden>
          <span className="ou-o" />
          <span className="ou-bang">!</span>
        </div>
        <div className="ou-bar"><span /></div>
      </div>
    </div>
  );
}
