import * as React from "react";
import { useDispatch, useSelector } from "react-redux";
import { LoadingScreen } from "~/components/ui/LoadingScreen";
import { openConnection } from "~/services";
import { AppState } from "~/store";

// Style Option 2: Cyber-Protocol / Sci-Fi HUD
const cyberStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');

  .cyber-wrapper * {
    box-sizing: border-box;
  }

  .cyber-wrapper {
    width: 100vw;
    height: 100vh;
    background-color: #020408;
    background-image:
      linear-gradient(rgba(0, 243, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 243, 255, 0.05) 1px, transparent 1px);
    background-size: 50px 50px;
    background-position: center;
    color: #e0faff;
    font-family: 'Share Tech Mono', monospace;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .cyber-wrapper::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: radial-gradient(circle at center, transparent 0%, #000000 90%);
    pointer-events: none;
    z-index: 1;
  }

  /* Header / Nav */
  .cyber-header {
    height: 80px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 40px;
    border-bottom: 1px solid rgba(0, 243, 255, 0.2);
    background: rgba(2, 4, 8, 0.9);
    z-index: 10;
    position: relative;
  }

  .cyber-logo {
    font-family: 'Orbitron', sans-serif;
    font-size: 24px;
    font-weight: 900;
    color: #00f3ff;
    text-transform: uppercase;
    letter-spacing: 2px;
    text-shadow: 0 0 10px rgba(0, 243, 255, 0.5);
  }

  .cyber-stats {
    display: flex;
    gap: 20px;
    color: #00f3ff;
    font-size: 14px;
    opacity: 0.8;
  }

  .stat-item {
    border: 1px solid rgba(0, 243, 255, 0.3);
    padding: 5px 10px;
    background: rgba(0, 243, 255, 0.05);
  }

  /* Main Content */
  .cyber-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 5;
    position: relative;
  }

  .cyber-title {
    font-family: 'Orbitron', sans-serif;
    font-size: 72px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 10px;
    color: #ffffff;
    margin-bottom: 10px;
    position: relative;
    text-shadow: 4px 4px 0px rgba(0, 243, 255, 0.2);
  }

  .cyber-subtitle {
    font-size: 18px;
    color: #00f3ff;
    letter-spacing: 4px;
    margin-bottom: 80px;
    text-transform: uppercase;
  }

  /* HUD Decorations */
  .hud-corner {
    position: absolute;
    width: 150px;
    height: 150px;
    border: 2px solid #00f3ff;
    opacity: 0.3;
    pointer-events: none;
  }
  .top-left { top: 100px; left: 40px; border-right: none; border-bottom: none; }
  .top-right { top: 100px; right: 40px; border-left: none; border-bottom: none; }
  .bottom-left { bottom: 40px; left: 40px; border-right: none; border-top: none; }
  .bottom-right { bottom: 40px; right: 40px; border-left: none; border-top: none; }

  /* Find Game Button (Cyber Style) */
  .cyber-btn-container {
    position: relative;
    padding: 4px;
    background: linear-gradient(90deg, transparent, #00f3ff, transparent);
  }

  .cyber-btn {
    width: 320px;
    height: 80px;
    background: #020408;
    border: 2px solid #00f3ff;
    color: #00f3ff;
    font-family: 'Orbitron', sans-serif;
    font-size: 28px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 4px;
    cursor: pointer;
    position: relative;
    transition: all 0.2s ease;
    box-shadow: 0 0 15px rgba(0, 243, 255, 0.1);
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
  }

  .cyber-btn::before {
    content: "";
    position: absolute;
    top: 0; left: -100%;
    width: 100%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(0, 243, 255, 0.2), transparent);
    transition: left 0.5s;
  }

  .cyber-btn:hover {
    background: #00f3ff;
    color: #000;
    box-shadow: 0 0 30px rgba(0, 243, 255, 0.6);
  }

  .cyber-btn:hover::before {
    left: 100%;
  }

  .btn-decor {
    position: absolute;
    background: #00f3ff;
    width: 10px; height: 10px;
  }
  .d-tl { top: 0; left: 0; }
  .d-tr { top: 0; right: 0; }
  .d-bl { bottom: 0; left: 0; }
  .d-br { bottom: 0; right: 0; }

  /* Error */
  .cyber-error {
    margin-top: 30px;
    color: #ff3333;
    background: rgba(255, 51, 51, 0.1);
    border: 1px solid #ff3333;
    padding: 10px 20px;
    font-family: 'Share Tech Mono', monospace;
  }
`;

export function MenuPage({ error }: { error?: string }) {
    const dispatch = useDispatch();
    const loadingMessage = useSelector(
        (state: AppState) => state.menu.loadingMessage
    );

    const onFindGameClick = React.useCallback(
        () => dispatch(openConnection()),
        [dispatch]
    );

    if (loadingMessage) {
        return <LoadingScreen message={loadingMessage} />;
    }

    return (
        <div className="cyber-wrapper">
            <style>{cyberStyles}</style>

            {/* Header */}
            <header className="cyber-header">
                <div className="cyber-logo">CC // SYSTEM</div>
                <div className="cyber-stats">
                    <div className="stat-item">SERVER: ONLINE</div>
                    <div className="stat-item">MS: 24</div>
                    <div className="stat-item">V.0.1.0</div>
                </div>
            </header>

            {/* HUD Elements */}
            <div className="hud-corner top-left"></div>
            <div className="hud-corner top-right"></div>
            <div className="hud-corner bottom-left"></div>
            <div className="hud-corner bottom-right"></div>

            {/* Main Content */}
            <div className="cyber-content">
                <div className="cyber-title">Creature Chess</div>
                <div className="cyber-subtitle">Tactical Simulation Loaded</div>

                <div className="cyber-btn-container">
                    <button onClick={onFindGameClick} className="cyber-btn">
                        <div className="btn-decor d-tl"></div>
                        <div className="btn-decor d-tr"></div>
                        <div className="btn-decor d-bl"></div>
                        <div className="btn-decor d-br"></div>
                        Find Game
                    </button>
                </div>

                {error && (
                    <div className="cyber-error">
                        [ERROR]: {error}
                    </div>
                )}
            </div>
        </div>
    );
}
