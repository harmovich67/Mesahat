import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Clock, Flame, Gauge, Snowflake } from 'lucide-react';
import { api } from '../../lib/api';
import { WEEKDAYS, cn, getLocalized } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';
import { Card, CardHeader, PageHeader, StatCard, Tabs } from '../../components/ui/Dash';
import { ErrorState, Skeleton } from '../../components/ui/Feedback';
import { Select } from '../../components/ui/Select';
import { HBarList, heatColor, heatText } from '../../components/charts/Charts';

const fmtHour = (h, lang) => {
  const h12 = h % 12 || 12;
  return lang === 'ar' ? `${h12}${h < 12 ? ' ص' : ' م'}` : `${h12}${h < 12 ? 'am' : 'pm'}`;
};

export function AdminOccupancy() {
  const { lang } = useLanguageStore();
  const ar = lang === 'ar';
  const [range, setRange] = useState('30d');
  const [spaceId, setSpaceId] = useState('');
  const [hover, setHover] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'reports', range],
    queryFn: () => api.get('/admin/reports', { range }),
  });

  const occ = data?.occupancy;
  const cells = (spaceId ? occ?.heatmap_by_space?.[spaceId] : occ?.heatmap) || [];
  const byKey = new Map(cells.map((c) => [`${c.weekday}|${c.hour}`, c]));
  const hours = occ ? [...new Set(occ.heatmap.map((c) => c.hour))].sort((a, b) => a - b) : [];
  // Egyptian business week starts Saturday.
  const dayOrder = [6, 0, 1, 2, 3, 4, 5];
  const days = WEEKDAYS[lang];

  const topHour = occ?.peak_hours?.reduce((a, b) => (b.booked_hours > (a?.booked_hours ?? -1) ? b : a), null);
  const topDay = occ?.peak_days?.reduce((a, b) => (b.booked_hours > (a?.booked_hours ?? -1) ? b : a), null);
  const hasData = (occ?.peak_hours || []).some((h) => h.booked_hours > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title={ar ? 'خريطة الإشغال' : 'Occupancy heatmap'}
        description={ar ? 'نسبة استخدام المساحات لكل ساعة وكل يوم — محسوبة من الحجوزات المؤكدة وساعات العمل الفعلية.' : 'Utilisation by weekday and hour, computed from confirmed bookings and real opening hours.'}
        actions={
          <Tabs
            value={range}
            onChange={setRange}
            options={[
              { value: '7d', label: ar ? '7 أيام' : '7d' },
              { value: '30d', label: ar ? '30 يوم' : '30d' },
              { value: '90d', label: ar ? '90 يوم' : '90d' },
            ]}
          />
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard index={0} loading={isLoading} icon={Gauge} label={ar ? 'متوسط الإشغال' : 'Average occupancy'} value={`${occ?.occupancy ?? 0}%`} hint={ar ? 'كل المساحات' : 'all spaces'} />
            <StatCard index={1} loading={isLoading} icon={Clock} tone="accent" label={ar ? 'ساعة الذروة' : 'Peak hour'} value={hasData && topHour ? fmtHour(topHour.hour, lang) : '—'} hint={hasData && topHour ? `${topHour.booked_hours} ${ar ? 'ساعة محجوزة' : 'booked h'}` : ar ? 'لا بيانات كافية' : 'not enough data'} />
            <StatCard index={2} loading={isLoading} icon={Flame} tone="rose" label={ar ? 'أنشط يوم' : 'Busiest day'} value={hasData && topDay ? days[topDay.weekday] : '—'} hint={hasData && topDay ? `${topDay.booked_hours} ${ar ? 'ساعة محجوزة' : 'booked h'}` : ar ? 'لا بيانات كافية' : 'not enough data'} />
          </div>

          <Card>
            <CardHeader
              title={ar ? 'الإشغال بالساعة' : 'Hourly utilisation'}
              description={hover ? `${days[hover.weekday]} · ${fmtHour(hover.hour, lang)} — ${hover.value}% (${hover.booked ?? 0} ${ar ? 'ساعة' : 'h'})` : ar ? 'مرّر على أي خلية لرؤية التفاصيل' : 'Hover a cell for details'}
              action={
                <Select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} wrapperClassName="w-52" aria-label="space">
                  <option value="">{ar ? 'كل المساحات' : 'All spaces'}</option>
                  {(occ?.per_space || []).map((s) => <option key={s.space_id} value={s.space_id}>{getLocalized(s.name, lang)}</option>)}
                </Select>
              }
            />
            {isLoading ? (
              <Skeleton className="h-72" />
            ) : (
              <div className="overflow-x-auto pb-1" dir={ar ? 'rtl' : 'ltr'}>
                <div className="min-w-[640px]">
                  <div className="grid gap-1" style={{ gridTemplateColumns: `88px repeat(${hours.length}, minmax(0, 1fr))` }}>
                    <div />
                    {hours.map((h) => (
                      <div key={h} className="num pb-1 text-center text-[10px] font-semibold text-stone-500">{fmtHour(h, lang)}</div>
                    ))}
                    {dayOrder.map((d) => (
                      <div key={d} className="contents">
                        <div className="flex items-center text-xs font-bold text-stone-700">{days[d]}</div>
                        {hours.map((h) => {
                          const c = byKey.get(`${d}|${h}`);
                          const v = c?.value ?? 0;
                          return (
                            <div
                              key={h}
                              onMouseEnter={() => setHover({ weekday: d, hour: h, value: v, booked: c?.booked })}
                              onMouseLeave={() => setHover(null)}
                              className={cn('num grid h-9 cursor-default place-items-center rounded-md text-[10px] font-bold transition-transform hover:z-10 hover:scale-110', !c && 'opacity-40')}
                              style={{ background: heatColor(v), color: heatText(v) }}
                              title={`${days[d]} ${fmtHour(h, lang)}: ${v}%`}
                            >
                              {v > 0 ? v : ''}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2 text-[11px] text-stone-500" dir="ltr">
                    <span>0%</span>
                    {[0, 20, 40, 60, 80, 100].map((v) => <span key={v} className="size-4 rounded" style={{ background: heatColor(v === 0 ? 1 : v) }} />)}
                    <span>100%</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader title={ar ? 'الإشغال لكل مساحة' : 'Occupancy per space'} />
              {isLoading ? (
                <Skeleton className="h-52" />
              ) : (
                <HBarList
                  format={(v) => `${v}%`}
                  items={(occ?.per_space || []).map((s) => ({ key: s.space_id, label: getLocalized(s.name, lang), value: s.occupancy, sub: `${s.booked_hours}/${s.available_hours}h` }))}
                />
              )}
            </Card>
            <Card>
              <CardHeader title={ar ? 'فرص رفع السعر' : 'Raise-price slots'} description={ar ? 'خلايا إشغالها 75% فأكثر' : 'cells at 75%+ occupancy'} action={<Flame className="size-5 text-rose-500" />} />
              <SlotList slots={occ?.insights?.raise_price} days={days} lang={lang} empty={ar ? 'لا توجد ساعات مزدحمة بعد.' : 'No saturated slots yet.'} />
            </Card>
            <Card>
              <CardHeader title={ar ? 'فرص الترويج' : 'Promote these slots'} description={ar ? 'ساعات عمل شبه خالية' : 'near-empty business hours'} action={<Snowflake className="size-5 text-sky-500" />} />
              <SlotList slots={occ?.insights?.promote} days={days} lang={lang} empty={ar ? 'لا توجد ساعات خاملة.' : 'No idle slots.'} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function SlotList({ slots, days, lang, empty }) {
  if (!slots?.length) return <p className="py-8 text-center text-sm text-stone-400">{empty}</p>;
  return (
    <ul className="space-y-2">
      {slots.map((s) => (
        <li key={`${s.weekday}-${s.hour}`} className="flex items-center justify-between rounded-xl bg-sand-50 px-3 py-2 text-sm">
          <span className="font-semibold text-ink">{days[s.weekday]}</span>
          <span className="num text-stone-500">{fmtHour(s.hour, lang)}</span>
          <span className="num rounded-full bg-white px-2 py-0.5 text-xs font-bold text-ink shadow-soft">{s.value}%</span>
        </li>
      ))}
    </ul>
  );
}
