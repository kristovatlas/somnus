import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addDays, todayStr } from "../utils/date";

export function useDateNavigation() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();

  const currentDate = date ?? todayStr();
  const isToday = currentDate === todayStr();

  const goTo = useCallback((d: string) => navigate(`/log/${d}`), [navigate]);
  const prev = useCallback(
    () => goTo(addDays(currentDate, -1)),
    [currentDate, goTo],
  );
  const next = useCallback(
    () => goTo(addDays(currentDate, 1)),
    [currentDate, goTo],
  );
  const today = useCallback(() => goTo(todayStr()), [goTo]);

  return { currentDate, isToday, goTo, prev, next, today };
}
