import { useState, useEffect, useCallback } from 'react';

interface RateLimitConfig {
  maxAttempts: number;
  cooldownMs: number;
  key: string;
}

interface RateLimitState {
  attempts: number;
  blockedUntil: number | null;
}

function getState(key: string): RateLimitState {
  try {
    const raw = localStorage.getItem(`rl:${key}`);
    if (!raw) return { attempts: 0, blockedUntil: null };

    const parsed: RateLimitState = JSON.parse(raw);
    if (parsed.blockedUntil && Date.now() > parsed.blockedUntil) {
      localStorage.removeItem(`rl:${key}`);
      return { attempts: 0, blockedUntil: null };
    }
    return parsed;
  } catch {
    return { attempts: 0, blockedUntil: null };
  }
}

function setState(key: string, state: RateLimitState) {
  localStorage.setItem(`rl:${key}`, JSON.stringify(state));
}

export function useRateLimit(config: RateLimitConfig) {
  const [state, setState_] = useState(() => getState(config.key));
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!state.blockedUntil) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      const diff = state.blockedUntil! - Date.now();
      if (diff <= 0) {
        setState(config.key, { attempts: 0, blockedUntil: null });
        setState_({ attempts: 0, blockedUntil: null });
        setRemaining(0);
      } else {
        setRemaining(Math.ceil(diff / 1000));
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.blockedUntil, config.key]);

  const isBlocked = state.blockedUntil !== null && Date.now() < state.blockedUntil;

  const recordAttempt = useCallback(() => {
    const current = getState(config.key);
    const newAttempts = current.attempts + 1;

    if (newAttempts >= config.maxAttempts) {
      const newState = { attempts: newAttempts, blockedUntil: Date.now() + config.cooldownMs };
      setState(config.key, newState);
      setState_(newState);
    } else {
      const newState = { ...current, attempts: newAttempts };
      setState(config.key, newState);
      setState_(newState);
    }
  }, [config]);

  const reset = useCallback(() => {
    localStorage.removeItem(`rl:${config.key}`);
    setState_({ attempts: 0, blockedUntil: null });
    setRemaining(0);
  }, [config.key]);

  return { isBlocked, remaining, recordAttempt, reset };
}
