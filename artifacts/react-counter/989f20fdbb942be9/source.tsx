import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);
  return <main className="p-10"><h1 className="text-3xl font-medium tracking-tight mb-6">React workshop</h1><button className="rounded-xl bg-kiln-accent-wash text-kiln-accent-text p-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kiln-accent-strong" onClick={() => setCount(count + 1)}>Count: {count}</button></main>;
}
