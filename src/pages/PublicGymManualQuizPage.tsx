import { useEffect } from 'react'
import { ManualQuizExperience } from '../features/publicQuiz/ManualQuizExperience'
import '../features/publicQuiz/public-quiz.css'

export function PublicGymManualQuizPage() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Prueba operativa de limpieza | Costa Clean BCN'

    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <main className="cc-public-quiz-page">
      <ManualQuizExperience />
    </main>
  )
}
