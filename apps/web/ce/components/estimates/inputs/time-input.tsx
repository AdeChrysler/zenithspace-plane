/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useEffect } from "react";

export type TEstimateTimeInputProps = {
  value?: number;
  handleEstimateInputValue: (value: string) => void;
};

export function EstimateTimeInput(props: TEstimateTimeInputProps) {
  const { value, handleEstimateInputValue } = props;
  const initialHours = value ? Math.floor(value / 60) : 0;
  const initialMinutes = value ? value % 60 : 0;
  const [hours, setHours] = useState<string>(initialHours > 0 ? String(initialHours) : "");
  const [minutes, setMinutes] = useState<string>(initialMinutes > 0 ? String(initialMinutes) : "");

  useEffect(() => {
    if (value !== undefined && value > 0) {
      setHours(Math.floor(value / 60) > 0 ? String(Math.floor(value / 60)) : "");
      setMinutes(value % 60 > 0 ? String(value % 60) : "");
    }
  }, [value]);

  const emitValue = (h: string, m: string) => {
    const totalHours = h === "" ? 0 : parseInt(h, 10);
    const totalMinutes = m === "" ? 0 : parseInt(m, 10);
    if (isNaN(totalHours) || isNaN(totalMinutes)) return;
    const total = totalHours * 60 + totalMinutes;
    handleEstimateInputValue(total > 0 ? String(total) : "");
  };

  return (
    <div className="flex items-center gap-1 px-2 py-2 w-full bg-transparent">
      <input value={hours} onChange={e => { if (e.target.value === "" || /^\d+$/.test(e.target.value)) { setHours(e.target.value); emitValue(e.target.value, minutes); } }} className="border-none focus:ring-0 focus:outline-none w-12 bg-transparent text-sm text-right" placeholder="0" autoFocus type="text" inputMode="numeric" />
      <span className="text-sm text-secondary">h</span>
      <input value={minutes} onChange={e => { if (e.target.value === "" || (/^\d+$/.test(e.target.value) && parseInt(e.target.value, 10) < 60)) { setMinutes(e.target.value); emitValue(hours, e.target.value); } }} className="border-none focus:ring-0 focus:outline-none w-12 bg-transparent text-sm text-right" placeholder="0" type="text" inputMode="numeric" />
      <span className="text-sm text-secondary">m</span>
    </div>
  );
}
