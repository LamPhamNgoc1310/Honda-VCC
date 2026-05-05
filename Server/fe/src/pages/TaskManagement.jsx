// pages/TaskManagement.jsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import TaskTable from "@/components/TaskManagement/TaskTable";
import TaskFilter from "@/components/TaskManagement/TaskFilter";
import TaskAnalysisTable from "@/components/TaskManagement/TaskAnalysisTable";
import TablePagination from "@/components/Notification/TablePagination";
import { useTaskRecord } from "@/hooks/TaskRecord/useTaskRecord";
import { useTaskFilter } from "@/hooks/TaskRecord/useTaskFilter";
import { useTaskAnalysis } from "@/hooks/TaskRecord/useTaskAnalysis";
import { useArea } from "@/contexts/AreaContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LIMIT = 20;
const ANALYSIS_LIMIT = 50;

export default function TaskManagement() {
  const { t } = useTranslation();
  const { currAreaId } = useArea();
  const areaId = currAreaId != null ? String(currAreaId) : "";

  const [analysisPage, setAnalysisPage] = useState(1);

  // --- Tab 1: Nhiệm vụ ---
  const {
    tasks,
    loading,
    error,
    total: totalTasks,
    refetch,
  } = useTaskRecord({
    page: 1,
    limit: 20,
    filters: {
      ...(areaId ? { area_id: areaId } : {}),
      today_only: true,
    },
  });

  const {
    searchTaskProperty,
    setSearchTaskProperty,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    statusFilter,
    setStatusFilter,
    currentPage,
    totalPages,
    paginatedTasks,
    total,
    handlePageChange,
    handleReset,
    hasActiveFilters,
  } = useTaskFilter(tasks, LIMIT);

  // --- Tab 2: Phân tích ---
  const {
    data: analysisData,
    totalItems: analysisTotalItems,
    totalPages: analysisTotalPages,
    loading: analysisLoading,
    error: analysisError,
    refetch: analysisRefetch,
  } = useTaskAnalysis({
    page: analysisPage,
    limit: ANALYSIS_LIMIT,
    area_id: areaId || undefined,
  });

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-semibold text-gray-50 mt-4 ml-4">
        {t("taskManagement.taskManagement")}
      </h1>

      <Tabs defaultValue="tasks" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tasks">{t("taskManagement.tabTasks")}</TabsTrigger>
          <TabsTrigger value="analysis">{t("taskManagement.tabAnalysis")}</TabsTrigger>
        </TabsList>

        {/* Tab 1: Nhiệm vụ */}
        <TabsContent value="tasks" className="space-y-6">
          <div className="glass rounded-lg border border-gray-200 overflow-hidden text-white p-6 lg:p-8">
            <TaskFilter
              searchTaskProperty={searchTaskProperty}
              setSearchTaskProperty={setSearchTaskProperty}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              onReset={handleReset}
            />

            <div className="mt-4 mb-2 text-base lg:text-lg text-white">
              {hasActiveFilters
                ? t("taskManagement.foundCount", { count: total, total: totalTasks })
                : t("taskManagement.totalCount", { count: total })}
            </div>

            <div className="mt-8">
              {loading && (
                <div className="space-y-3">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              )}

              {error && (
                <div className="text-center py-12">
                  <p className="text-red-400 text-lg mb-4">{t("taskManagement.errorLoad")}</p>
                  <Button onClick={refetch} variant="outline">{t("taskManagement.retry")}</Button>
                </div>
              )}

              {!loading && !error && paginatedTasks.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-xl">
                    {hasActiveFilters
                      ? t("taskManagement.noTasksFiltered")
                      : t("taskManagement.noTasks")}
                  </p>
                </div>
              )}

              {!loading && !error && paginatedTasks.length > 0 && (
                <>
                  <TaskTable tasks={paginatedTasks} />
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    total={total}
                    totalTasks={totalTasks}
                    hasActiveFilters={hasActiveFilters}
                    itemsPerPage={LIMIT}
                  />
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Phân tích */}
        <TabsContent value="analysis" className="space-y-6">
          <div className="glass rounded-lg border border-gray-200 overflow-hidden text-white p-6 lg:p-8">

            <div className="mb-2 text-base lg:text-lg text-white">
              {t("taskManagement.totalCount", { count: analysisTotalItems })}
            </div>

            <div className="mt-4">
              {analysisLoading && (
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              )}

              {analysisError && (
                <div className="text-center py-12">
                  <p className="text-red-400 text-lg mb-4">{t("taskManagement.errorLoadAnalysis")}</p>
                  <Button onClick={analysisRefetch} variant="outline">{t("taskManagement.retry")}</Button>
                </div>
              )}

              {!analysisLoading && !analysisError && analysisData.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-xl">{t("taskManagement.noAnalysisData")}</p>
                </div>
              )}

              {!analysisLoading && !analysisError && analysisData.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <TaskAnalysisTable data={analysisData} />
                  </div>
                  <TablePagination
                    currentPage={analysisPage}
                    totalPages={analysisTotalPages}
                    onPageChange={setAnalysisPage}
                    total={analysisTotalItems}
                    totalTasks={analysisTotalItems}
                    hasActiveFilters={false}
                    itemsPerPage={ANALYSIS_LIMIT}
                  />
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
