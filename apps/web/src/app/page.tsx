import { Button, Card } from '@/components/ui';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">Вжик</h1>
      <p className="mt-2 text-gray-600">
        Phase 1 — Foundation. Design system і базова автентифікація вже підключені.
      </p>
      <Card className="mt-8">
        <h2 className="text-xl font-semibold">Наступний крок</h2>
        <p className="mt-1 text-gray-600">Phase 2 — Marketplace Core (категорії, оголошення, пошук).</p>
        <Button className="mt-4">Додати оголошення</Button>
      </Card>
    </div>
  );
}
