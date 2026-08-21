import { MonitorManager } from "@/components/MonitorManager";
import { listMonitors } from "@/lib/db/monitors";
import { isDemoMode } from "@/lib/config/demo";

export const dynamic = "force-dynamic";

export default function MonitorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">監視対象</h1>
        <p className="mt-1 text-sm text-muted">
          任意の広告主を登録し、手動で広告を取得できます。
        </p>
      </div>
      <MonitorManager monitors={listMonitors()} demoMode={isDemoMode()} />
    </div>
  );
}
