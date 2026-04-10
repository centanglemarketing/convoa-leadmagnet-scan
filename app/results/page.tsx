import { Suspense } from 'react'
import ResultsClient from './ResultsClient'

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-pulse text-gray-400 text-lg">Loading your results...</div>
        </div>
      }
    >
      <ResultsClient />
    </Suspense>
  )
}
