// hooks/TaskRecord/useTaskAnalysis.js
import { useState, useEffect, useCallback } from "react";
import { getAnalyzeStartTarget } from "@/services/taskRecord";

export function useTaskAnalysis({ page = 1, limit = 50, area_id } = {}) {
    const [data, setData] = useState([]);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAnalyzeStartTarget({ page, limit, area_id });
            setData(result.data || []);
            setTotalItems(result.total_items || 0);
            setTotalPages(result.total_pages || 0);
        } catch (err) {
            console.error("[useTaskAnalysis] Error:", err);
            setError(err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [page, limit, area_id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, totalItems, totalPages, loading, error, refetch: fetchData };
}
