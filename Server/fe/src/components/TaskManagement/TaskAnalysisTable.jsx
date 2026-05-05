// components/TaskManagement/TaskAnalysisTable.jsx
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

function formatDateTime(isoStr) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const mon = String(d.getMonth() + 1).padStart(2, "0");
    return `${hh}:${mm}:${ss} ${day}/${mon}/${d.getFullYear()}`;
  } catch {
    return isoStr;
  }
}

export default function TaskAnalysisTable({ data }) {
  const { t } = useTranslation();

  const thClass = "font-semibold text-white py-3 px-3 lg:py-4 lg:px-4 text-base lg:text-lg";
  const tdClass = "text-white py-3 px-3 lg:py-4 lg:px-4 text-base lg:text-lg";

  return (
    <Table className="text-base lg:text-lg">
      <TableHeader>
        <TableRow>
          <TableHead className={thClass}>{t("taskAnalysis.startTarget")}</TableHead>
          <TableHead className={thClass}>{t("taskAnalysis.latestTime")}</TableHead>
          <TableHead className={thClass}>{t("taskAnalysis.countToday")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className={`text-center text-gray-400 ${tdClass}`}>
              {t("notification.no_data")}
            </TableCell>
          </TableRow>
        ) : (
          data.map((item, index) => (
            <TableRow key={`${item.start_target}-${index}`} className="text-white hover:bg-white/5">
              <TableCell className={`font-medium ${tdClass}`}>
                {item.start_target ?? "—"}
              </TableCell>
              <TableCell className={`text-sm ${tdClass}`}>
                {formatDateTime(item.updated_at)}
              </TableCell>
              <TableCell className={tdClass}>
                <Badge className="bg-cyan-600 hover:bg-cyan-600 text-white text-sm lg:text-base px-3 py-0.5 border-0">
                  {item.count_today ?? 0}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
