/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Earth, Lock } from "lucide-react";
import type { IProjectView } from "@plane/types";
import { EViewAccess } from "@plane/types";
import { CustomSelect } from "@plane/ui";

type Props = {
  control: Control<IProjectView>;
};

const ACCESS_OPTIONS = [
  { key: EViewAccess.PUBLIC, label: "Public", icon: Earth },
  { key: EViewAccess.PRIVATE, label: "Private", icon: Lock },
];

export function AccessController(props: Props) {
  const { control } = props;

  return (
    <Controller
      control={control}
      name="access"
      render={({ field: { onChange, value } }) => {
        const selectedOption = ACCESS_OPTIONS.find((o) => o.key === value) ?? ACCESS_OPTIONS[0];

        return (
          <CustomSelect
            value={value}
            label={
              <div className="flex items-center gap-1.5 text-sm">
                <selectedOption.icon className="size-3.5" />
                <span>{selectedOption.label}</span>
              </div>
            }
            onChange={onChange}
            buttonClassName="border border-subtle rounded-md px-3 py-1.5"
            placement="bottom-start"
          >
            {ACCESS_OPTIONS.map((option) => (
              <CustomSelect.Option key={option.key} value={option.key}>
                <div className="flex items-center gap-1.5">
                  <option.icon className="size-3.5" />
                  <span>{option.label}</span>
                </div>
              </CustomSelect.Option>
            ))}
          </CustomSelect>
        );
      }}
    />
  );
}
