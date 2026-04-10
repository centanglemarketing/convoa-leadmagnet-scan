import { Suspense } from 'react'
import ScanningClient from './ScanningClient'

export default function ScanningPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-pulse text-gray-400 text-lg">Loading...</div>
        </div>
      }
    >
      <ScanningClient />
    </Suspense>
  )
}
