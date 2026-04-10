import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Apple, Flame, TrendingUp, Users } from "lucide-react";
import { api } from "../lib/api";
import { safeParseJson } from "../lib/json";
import { formatDate } from "../lib/datetime";
import type { ApiAthlete, ApiNutritionPlan } from "../types/api";

type Meal = {
  time?: string;
  items?: string;
};

type PlanRecord = {
  id: number;
  athleteName: string;
  athleteAvatar: string;
  planType: string;
  calories?: number | null;
  macros: {
    protein?: number;
    carbs?: number;
    fats?: number;
  };
  meals: Meal[];
  restrictions?: string | null;
  status: "active" | "completed";
  startLabel: string;
  endLabel: string;
};

const PLAN_TYPE_LABELS: Record<string, string> = {
  bulking: "РќР°Р±РѕСЂ РјР°СЃСЃС‹",
  cutting: "РЎРЅРёР¶РµРЅРёРµ РІРµСЃР°",
  endurance: "Р’С‹РЅРѕСЃР»РёРІРѕСЃС‚СЊ",
  special: "РЎРїРµС†РёР°Р»СЊРЅС‹Р№",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function mapPlan(plan: ApiNutritionPlan, athlete: ApiAthlete | undefined): PlanRecord {
  const meta = athlete ? safeParseJson<{ avatar?: string }>(athlete.contact_info, {}) : {};
  const macros = safeParseJson<{ protein?: number; carbs?: number; fats?: number }>(plan.macros, {});
  const meals = safeParseJson<Meal[]>(plan.meals, []);
  const status =
    plan.end_date && new Date(plan.end_date).getTime() < Date.now() ? ("completed" as const) : ("active" as const);

  return {
    id: plan.id,
    athleteName: athlete?.name ?? "РќРµРёР·РІРµСЃС‚РЅС‹Р№ СЃРїРѕСЂС‚СЃРјРµРЅ",
    athleteAvatar: meta?.avatar || getInitials(athlete?.name ?? "??"),
    planType: plan.plan_type ?? "custom",
    calories: plan.calories,
    macros,
    meals,
    restrictions: plan.restrictions,
    status,
    startLabel: plan.start_date ? formatDate(plan.start_date) : "вЂ”",
    endLabel: plan.end_date ? formatDate(plan.end_date) : "вЂ”",
  };
}

function getPlanTypeLabel(type: string) {
  return PLAN_TYPE_LABELS[type] ?? "РРЅРґРёРІРёРґСѓР°Р»СЊРЅС‹Р№";
}

export function Nutrition() {
  const [activeTab, setActiveTab] = useState<"plans" | "athletes">("plans");
  const [searchQuery, setSearchQuery] = useState("");
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        setLoading(true);
        const [athletes, nutrition] = await Promise.all([
          api.getAthletes({ limit: 200 }),
          api.getNutritionPlans({ limit: 200 }),
        ]);
        if (ignore) return;

        const athleteMap = new Map(athletes.map((athlete) => [athlete.id, athlete]));
        const mapped = nutrition.map((plan) => mapPlan(plan, athleteMap.get(plan.athlete_id)));

        setPlans(mapped);
        setSelectedPlanId(mapped[0]?.id ?? null);
        setError(null);
      } catch (err) {
        if (ignore) return;
        setError(err instanceof Error ? err.message : "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РїР»Р°РЅС‹ РїРёС‚Р°РЅРёСЏ");
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  const filteredPlans = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase();
    return plans.filter(
      (plan) =>
        plan.athleteName.toLowerCase().includes(normalizedQuery) ||
        getPlanTypeLabel(plan.planType).toLowerCase().includes(normalizedQuery)
    );
  }, [plans, searchQuery]);

  const selectedPlan =
    filteredPlans.find((plan) => plan.id === selectedPlanId) ||
    plans.find((plan) => plan.id === selectedPlanId) ||
    plans[0] ||
    null;

  useEffect(() => {
    if (!selectedPlan && plans.length) {
      setSelectedPlanId(plans[0].id);
    }
  }, [selectedPlan, plans]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-600">
          Р—Р°РіСЂСѓР·РєР° РїР»Р°РЅРѕРІ РїРёС‚Р°РЅРёСЏ...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-gray-900 mb-2">РџРёС‚Р°РЅРёРµ</h1>
            <p className="text-gray-600">РџР»Р°РЅС‹ РїРёС‚Р°РЅРёСЏ Рё СЂРµРєРѕРјРµРЅРґР°С†РёРё</p>
          </div>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Plus className="w-5 h-5" />
            РЎРѕР·РґР°С‚СЊ РїР»Р°РЅ
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("plans")}
            className={`px-4 py-3 transition-colors relative ${
              activeTab === "plans" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            РџР»Р°РЅС‹ РїРёС‚Р°РЅРёСЏ
            {activeTab === "plans" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </button>
          <button
            onClick={() => setActiveTab("athletes")}
            className={`px-4 py-3 transition-colors relative ${
              activeTab === "athletes" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            РЎРїРѕСЂС‚СЃРјРµРЅС‹
            {activeTab === "athletes" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </button>
        </div>
      </div>

      {/* Plans Tab */}
      {activeTab === "plans" && selectedPlan && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plans List */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="РџРѕРёСЃРє СЃРїРѕСЂС‚СЃРјРµРЅРѕРІ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {filteredPlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`w-full text-left bg-white p-6 rounded-xl border transition-all ${
                  selectedPlan?.id === plan.id ? "border-blue-300 shadow-lg" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-gray-900 pr-2">{plan.athleteName}</p>
                    <span
                      className={`px-3 py-1 rounded ${
                        plan.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {plan.status === "active" ? "РђРєС‚РёРІРµРЅ" : "Р—Р°РІРµСЂС€РµРЅ"}
                    </span>
                  </div>
                  <span className="px-2 py-1 rounded bg-blue-50 text-blue-700">{getPlanTypeLabel(plan.planType)}</span>
                </div>
                <div className="flex items-center gap-4 text-gray-600">
                  <div className="flex items-center gap-1">
                    <Flame className="w-4 h-4" />
                    <span>{plan.calories ?? "вЂ”"} РєРєР°Р»</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{plan.startLabel}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Plan Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-gray-900 mb-2">{selectedPlan.athleteName}</h2>
                  <span className="px-3 py-1 rounded bg-blue-50 text-blue-700">{getPlanTypeLabel(selectedPlan.planType)}</span>
                </div>
                <button className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ
                </button>
              </div>

              {/* Macros */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-orange-50 rounded-lg text-center">
                  <Flame className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                  <p className="text-gray-600 mb-1">РљР°Р»РѕСЂРёРё</p>
                  <p className="text-orange-600">{selectedPlan.calories ?? "вЂ”"}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <p className="text-gray-600 mb-1">Р‘РµР»РєРё</p>
                  <p className="text-blue-600">{selectedPlan.macros.protein ?? "вЂ”"} Рі</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-gray-600 mb-1">РЈРіР»РµРІРѕРґС‹</p>
                  <p className="text-green-600">{selectedPlan.macros.carbs ?? "вЂ”"} Рі</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg text-center">
                  <p className="text-gray-600 mb-1">Р–РёСЂС‹</p>
                  <p className="text-yellow-600">{selectedPlan.macros.fats ?? "вЂ”"} Рі</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-600 mb-1">РќР°С‡Р°Р»Рѕ</p>
                  <p className="text-gray-900">{selectedPlan.startLabel}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-600 mb-1">РћРєРѕРЅС‡Р°РЅРёРµ</p>
                  <p className="text-gray-900">{selectedPlan.endLabel}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-600 mb-1">РћРіСЂР°РЅРёС‡РµРЅРёСЏ</p>
                  <p className="text-gray-900">{selectedPlan.restrictions ?? "РќРµС‚"}</p>
                </div>
              </div>
            </div>

            {/* Meals */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-gray-900 mb-6">Р Р°С†РёРѕРЅ</h3>
              {selectedPlan.meals.length ? (
                <div className="space-y-3">
                  {selectedPlan.meals.map((meal, index) => (
                    <div key={`${meal.time}-${index}`} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                      <div className="text-center px-4 py-2 bg-blue-50 rounded-lg min-w-[80px]">
                        <p className="text-blue-600">{meal.time ?? "вЂ”"}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900 mb-1">{meal.items ?? "РќРµ СѓРєР°Р·Р°РЅРѕ"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">РџРѕРґСЂРѕР±РЅС‹Р№ СЃРїРёСЃРѕРє РїСЂРёРµРјРѕРІ РїРёС‰Рё РЅРµ Р·Р°РґР°РЅ</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Athletes Tab */}
      {activeTab === "athletes" && (
        <div className="space-y-6">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="РџРѕРёСЃРє СЃРїРѕСЂС‚СЃРјРµРЅРѕРІ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredPlans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white flex-shrink-0">
                    {plan.athleteAvatar}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-gray-900 mb-1">{plan.athleteName}</h3>
                    <p className="text-gray-600 mb-2">{getPlanTypeLabel(plan.planType)}</p>
                    <div className="flex items-center gap-2">
                      <Apple className="w-4 h-4 text-green-600" />
                      <span className="text-gray-600">РљР°Р»РѕСЂРёР№РЅРѕСЃС‚СЊ: </span>
                      <span className="text-green-600">{plan.calories ?? "вЂ”"} РєРєР°Р»</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <p className="text-gray-600 mb-1">Р‘РµР»РєРё</p>
                    <p className="text-blue-600">{plan.macros.protein ?? "вЂ”"} Рі</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-gray-600 mb-1">РЈРіР»РµРІРѕРґС‹</p>
                    <p className="text-green-600">{plan.macros.carbs ?? "вЂ”"} Рі</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg text-center">
                    <p className="text-gray-600 mb-1">Р–РёСЂС‹</p>
                    <p className="text-yellow-600">{plan.macros.fats ?? "вЂ”"} Рі</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600">РџРµСЂРёРѕРґ</span>
                    <span className="text-gray-900">
                      {plan.startLabel} вЂ” {plan.endLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <TrendingUp className="w-4 h-4" />
                    <span>РЎС‚Р°С‚СѓСЃ: {plan.status === "active" ? "РђРєС‚РёРІРµРЅ" : "Р—Р°РІРµСЂС€РµРЅ"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Apple, Flame, TrendingUp, Users } from "lucide-react";
import { api } from "../lib/api";
import { safeParseJson } from "../lib/json";
import { formatDate } from "../lib/datetime";
import type { ApiAthlete, ApiNutritionPlan } from "../types/api";

type Meal = {
  time?: string;
  items?: string;
};

type PlanRecord = {
  id: number;
  athleteName: string;
  athleteAvatar: string;
  planType: string;
  calories?: number | null;
  macros: {
    protein?: number;
    carbs?: number;
    fats?: number;
  };
  meals: Meal[];
  restrictions?: string | null;
  status: "active" | "completed";
  startLabel: string;
  endLabel: string;
};

const PLAN_TYPE_LABELS: Record<string, string> = {
  bulking: "РќР°Р±РѕСЂ РјР°СЃСЃС‹",
  cutting: "РЎРЅРёР¶РµРЅРёРµ РІРµСЃР°",
  endurance: "Р’С‹РЅРѕСЃР»РёРІРѕСЃС‚СЊ",
  special: "РЎРїРµС†РёР°Р»СЊРЅС‹Р№",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function mapPlan(plan: ApiNutritionPlan, athlete: ApiAthlete | undefined): PlanRecord {
  const meta = athlete ? safeParseJson<{ avatar?: string }>(athlete.contact_info, {}) : {};
  const macros = safeParseJson<{ protein?: number; carbs?: number; fats?: number }>(plan.macros, {});
  const meals = safeParseJson<Meal[]>(plan.meals, []);
  const status =
    plan.end_date && new Date(plan.end_date).getTime() < Date.now() ? ("completed" as const) : ("active" as const);

  return {
    id: plan.id,
    athleteName: athlete?.name ?? "РќРµРёР·РІРµСЃС‚РЅС‹Р№ СЃРїРѕСЂС‚СЃРјРµРЅ",
    athleteAvatar: meta?.avatar || getInitials(athlete?.name ?? "??"),
    planType: plan.plan_type ?? "custom",
    calories: plan.calories,
    macros,
    meals,
    restrictions: plan.restrictions,
    status,
    startLabel: plan.start_date ? formatDate(plan.start_date) : "вЂ”",
    endLabel: plan.end_date ? formatDate(plan.end_date) : "вЂ”",
  };
}

function getPlanTypeLabel(type: string) {
  return PLAN_TYPE_LABELS[type] ?? "РРЅРґРёРІРёРґСѓР°Р»СЊРЅС‹Р№";
}

export function Nutrition() {
  const [activeTab, setActiveTab] = useState<"plans" | "athletes">("plans");
  const [searchQuery, setSearchQuery] = useState("");
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        setLoading(true);
        const [athletes, nutrition] = await Promise.all([
          api.getAthletes({ limit: 200 }),
          api.getNutritionPlans({ limit: 200 }),
        ]);
        if (ignore) return;

        const athleteMap = new Map(athletes.map((athlete) => [athlete.id, athlete]));
        const mapped = nutrition.map((plan) => mapPlan(plan, athleteMap.get(plan.athlete_id)));

        setPlans(mapped);
        setSelectedPlanId(mapped[0]?.id ?? null);
        setError(null);
      } catch (err) {
        if (ignore) return;
        setError(err instanceof Error ? err.message : "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РїР»Р°РЅС‹ РїРёС‚Р°РЅРёСЏ");
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  const filteredPlans = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase();
    return plans.filter(
      (plan) =>
        plan.athleteName.toLowerCase().includes(normalizedQuery) ||
        getPlanTypeLabel(plan.planType).toLowerCase().includes(normalizedQuery)
    );
  }, [plans, searchQuery]);

  const selectedPlan =
    filteredPlans.find((plan) => plan.id === selectedPlanId) || plans.find((plan) => plan.id === selectedPlanId) || plans[0] || null;

  useEffect(() => {
    if (!selectedPlan && plans.length) {
      setSelectedPlanId(plans[0].id);
    }
  }, [selectedPlan, plans]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-600">
          Р—Р°РіСЂСѓР·РєР° РїР»Р°РЅРѕРІ РїРёС‚Р°РЅРёСЏ...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-gray-900 mb-2">РџРёС‚Р°РЅРёРµ</h1>
            <p className="text-gray-600">РџР»Р°РЅС‹ РїРёС‚Р°РЅРёСЏ Рё СЂРµРєРѕРјРµРЅРґР°С†РёРё</p>
          </div>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Plus className="w-5 h-5" />
            РЎРѕР·РґР°С‚СЊ РїР»Р°РЅ
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("plans")}
            className={`px-4 py-3 transition-colors relative ${
              activeTab === "plans" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            РџР»Р°РЅС‹ РїРёС‚Р°РЅРёСЏ
            {activeTab === "plans" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </button>
          <button
            onClick={() => setActiveTab("athletes")}
            className={`px-4 py-3 transition-colors relative ${
              activeTab === "athletes" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            РЎРїРѕСЂС‚СЃРјРµРЅС‹
            {activeTab === "athletes" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </button>
        </div>
      </div>

      {/* Plans Tab */}
      {activeTab === "plans" && selectedPlan && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plans List */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="РџРѕРёСЃРє СЃРїРѕСЂС‚СЃРјРµРЅРѕРІ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {filteredPlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`w-full text-left bg-white p-6 rounded-xl border transition-all ${
                  selectedPlan?.id === plan.id ? "border-blue-300 shadow-lg" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-gray-900 pr-2">{plan.athleteName}</p>
                    <span className={`px-3 py-1 rounded ${plan.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                      {plan.status === "active" ? "РђРєС‚РёРІРµРЅ" : "Р—Р°РІРµСЂС€РµРЅ"}
                    </span>
                  </div>
                  <span className={`px-2 py-1 rounded ${plan.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                    {getPlanTypeLabel(plan.planType)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-gray-600">
                  <div className="flex items-center gap-1">
                    <Flame className="w-4 h-4" />
                    <span>{plan.calories ?? "вЂ”"} РєРєР°Р»</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{plan.startLabel}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Plan Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-gray-900 mb-2">{selectedPlan.athleteName}</h2>
                  <span className={`px-3 py-1 rounded ${"bg-blue-50 text-blue-700"}`}>
                    {getPlanTypeLabel(selectedPlan.planType)}
                  </span>
                </div>
                <button className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ
                </button>
              </div>

              {/* Macros */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-orange-50 rounded-lg text-center">
                  <Flame className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                  <p className="text-gray-600 mb-1">РљР°Р»РѕСЂРёРё</p>
                  <p className="text-orange-600">{selectedPlan.calories ?? "вЂ”"}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <p className="text-gray-600 mb-1">Р‘РµР»РєРё</p>
                  <p className="text-blue-600">{selectedPlan.macros.protein ?? "вЂ”"} Рі</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-gray-600 mb-1">РЈРіР»РµРІРѕРґС‹</p>
                  <p className="text-green-600">{selectedPlan.macros.carbs ?? "вЂ”"} Рі</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg text-center">
                  <p className="text-gray-600 mb-1">Р–РёСЂС‹</p>
                  <p className="text-yellow-600">{selectedPlan.macros.fats ?? "вЂ”"} Рі</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-600 mb-1">РќР°С‡Р°Р»Рѕ</p>
                  <p className="text-gray-900">{selectedPlan.startLabel}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-600 mb-1">РћРєРѕРЅС‡Р°РЅРёРµ</p>
                  <p className="text-gray-900">{selectedPlan.endLabel}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-600 mb-1">РћРіСЂР°РЅРёС‡РµРЅРёСЏ</p>
                  <p className="text-gray-900">{selectedPlan.restrictions ?? "РќРµС‚"}</p>
                </div>
              </div>
            </div>

            {/* Meals */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-gray-900 mb-6">Р Р°С†РёРѕРЅ</h3>
              {selectedPlan.meals.length ? (
                <div className="space-y-3">
                  {selectedPlan.meals.map((meal, index) => (
                    <div key={`${meal.time}-${index}`} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                      <div className="text-center px-4 py-2 bg-blue-50 rounded-lg min-w-[80px]">
                        <p className="text-blue-600">{meal.time ?? "вЂ”"}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900 mb-1">{meal.items ?? "РќРµ СѓРєР°Р·Р°РЅРѕ"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">РџРѕРґСЂРѕР±РЅС‹Р№ СЃРїРёСЃРѕРє РїСЂРёРµРјРѕРІ РїРёС‰Рё РЅРµ Р·Р°РґР°РЅ</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Athletes Tab */}
      {activeTab === "athletes" && (
        <div className="space-y-6">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="РџРѕРёСЃРє СЃРїРѕСЂС‚СЃРјРµРЅРѕРІ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredPlans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white flex-shrink-0">
                    {plan.athleteAvatar}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-gray-900 mb-1">{plan.athleteName}</h3>
                    <p className="text-gray-600 mb-2">{getPlanTypeLabel(plan.planType)}</p>
                    <div className="flex items-center gap-2">
                      <Apple className="w-4 h-4 text-green-600" />
                      <span className="text-gray-600">РљР°Р»РѕСЂРёР№РЅРѕСЃС‚СЊ: </span>
                      <span className="text-green-600">{plan.calories ?? "вЂ”"} РєРєР°Р»</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <p className="text-gray-600 mb-1">Р‘РµР»РєРё</p>
                    <p className="text-blue-600">{plan.macros.protein ?? "вЂ”"} Рі</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-gray-600 mb-1">РЈРіР»РµРІРѕРґС‹</p>
                    <p className="text-green-600">{plan.macros.carbs ?? "вЂ”"} Рі</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg text-center">
                    <p className="text-gray-600 mb-1">Р–РёСЂС‹</p>
                    <p className="text-yellow-600">{plan.macros.fats ?? "вЂ”"} Рі</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600">РџРµСЂРёРѕРґ</span>
                    <span className="text-gray-900">
                      {plan.startLabel} вЂ” {plan.endLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <TrendingUp className="w-4 h-4" />
                    <span>РЎС‚Р°С‚СѓСЃ: {plan.status === "active" ? "РђРєС‚РёРІРµРЅ" : "Р—Р°РІРµСЂС€РµРЅ"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


