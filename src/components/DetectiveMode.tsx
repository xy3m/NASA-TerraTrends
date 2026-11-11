import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { DETECTIVE_CASES } from '../services/detectiveCases';
import { HOTSPOT_REGIONS, EARTH_VARIABLES, generateCuratedTimeSeries } from '../services/nasaData';
import { analyzeTrend } from '../services/statistics';
import { DetectiveCase } from '../types/earthScience';
import { TimeSeriesChart } from './TimeSeriesChart';
import { SignificanceBadge } from './SignificanceBadge';
import { 
  Search, 
  Award, 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  RotateCcw, 
  Sparkles, 
  ShieldCheck, 
  FileText 
} from 'lucide-react';

export const DetectiveMode: React.FC = () => {
  const [selectedCase, setSelectedCase] = useState<DetectiveCase>(DETECTIVE_CASES[0]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [quizAnswers, setQuizAnswers] = useState<{ [qIndex: number]: number }>({});
  const [showExplanations, setShowExplanations] = useState<{ [qIndex: number]: boolean }>({});
  const [caseCompleted, setCaseCompleted] = useState<boolean>(false);

  // Load region and variable for current case
  const region = HOTSPOT_REGIONS.find(r => r.id === selectedCase.regionId) || HOTSPOT_REGIONS[0];
  const variable = EARTH_VARIABLES.find(v => v.id === selectedCase.variableId) || EARTH_VARIABLES[0];

  const points = React.useMemo(() => {
    return generateCuratedTimeSeries(region, variable);
  }, [region, variable]);

  const stats = React.useMemo(() => {
    return analyzeTrend(points, variable.id, variable.name, variable.unit, region.name, region.coordinates, true);
  }, [points, variable, region]);

  const handleSelectAnswer = (qIndex: number, optionIndex: number) => {
    setQuizAnswers(prev => ({ ...prev, [qIndex]: optionIndex }));
    setShowExplanations(prev => ({ ...prev, [qIndex]: true }));
  };

  const isQuizPassed = selectedCase.guidingQuestions.every(
    (_, idx) => quizAnswers[idx] === selectedCase.guidingQuestions[idx].correctIndex
  );

  const handleCompleteCase = () => {
    setCaseCompleted(true);
    // Trigger confetti
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch {
      // Fallback if canvas is blocked
    }
  };

  const handleResetCase = () => {
    setQuizAnswers({});
    setShowExplanations({});
    setCaseCompleted(false);
    setCurrentStep(1);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 rounded-2xl border border-amber-800/40 p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-slate-950 uppercase tracking-widest flex items-center space-x-1">
              <Search className="w-3 h-3" />
              <span>Interactive Student Mission</span>
            </span>
            <span className="text-xs text-slate-400">• Become a NASA Data Detective</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Earth Science Mystery Dossiers
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Learn how space scientists separate seasonal noise from genuine climate trends, test statistical significance, and solve real-world planetary mysteries.
          </p>
        </div>

        {/* Case Selector Pills */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {DETECTIVE_CASES.map(c => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCase(c);
                handleResetCase();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedCase.id === c.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      {/* Case Header Details */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block">
              {selectedCase.mysteryTitle}
            </span>
            <h3 className="text-xl font-black text-white mt-0.5">{selectedCase.title}</h3>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono">
              Target: <strong>{region.name}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 font-mono">
              Variable: <strong>{variable.shortName}</strong>
            </span>
            <span className="px-2 py-1 rounded-lg bg-amber-950/80 border border-amber-800 text-amber-300 font-semibold">
              {selectedCase.difficulty}
            </span>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed italic bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
          "{selectedCase.teaser}"
        </p>

        {/* Steps Breadcrumb */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <button
            onClick={() => setCurrentStep(1)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              currentStep === 1
                ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <span className="text-[10px] font-mono block text-slate-500">STEP 1</span>
            <span className="text-xs font-bold block">1. Briefing & Suspects</span>
          </button>

          <button
            onClick={() => setCurrentStep(2)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              currentStep === 2
                ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <span className="text-[10px] font-mono block text-slate-500">STEP 2</span>
            <span className="text-xs font-bold block">2. Satellite Evidence</span>
          </button>

          <button
            onClick={() => setCurrentStep(3)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              currentStep === 3
                ? 'bg-amber-600/20 border-amber-500 text-amber-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}
          >
            <span className="text-[10px] font-mono block text-slate-500">STEP 3</span>
            <span className="text-xs font-bold block">3. Detective Verdict</span>
          </button>
        </div>
      </div>

      {/* STEP 1: Briefing & Suspects */}
      {currentStep === 1 && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
          <div className="space-y-3">
            <h4 className="text-base font-bold text-white flex items-center space-x-2">
              <FileText className="w-5 h-5 text-amber-400" />
              <span>Official Case Briefing</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {selectedCase.briefing}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2">
              <h5 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                Orbital Sensor Clue
              </h5>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedCase.satelliteClue}
              </p>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2">
              <h5 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Primary Suspect Drivers
              </h5>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                {selectedCase.suspectDrivers.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setCurrentStep(2)}
              className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all"
            >
              <span>Examine Satellite Evidence</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Satellite Evidence (Interactive Chart) */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <TimeSeriesChart
            points={points}
            variable={variable}
            regionName={region.name}
            stats={stats}
          />

          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-300">
              <span className="font-bold text-white block mb-0.5">Detective Guidance:</span>
              Look at the difference between the <strong>Raw Seasonal Data</strong> and the <strong>Deseasonalized Anomaly</strong>. Notice how the linear trend line slices right through!
            </div>
            <button
              onClick={() => setCurrentStep(3)}
              className="flex items-center space-x-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all shrink-0"
            >
              <span>Proceed to Detective Questions</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Detective Quiz & Final Verdict */}
      {currentStep === 3 && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
          <div className="space-y-1">
            <h4 className="text-base font-bold text-white flex items-center space-x-2">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              <span>Detective Verification Questions</span>
            </h4>
            <p className="text-xs text-slate-400">
              Answer the questions below based on your observation of the satellite time-series.
            </p>
          </div>

          {/* Question List */}
          <div className="space-y-6">
            {selectedCase.guidingQuestions.map((q, qIndex) => {
              const selectedOption = quizAnswers[qIndex];
              const isAnswered = selectedOption !== undefined;
              const isCorrect = selectedOption === q.correctIndex;

              return (
                <div key={qIndex} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Question #{qIndex + 1}
                    </span>
                    {isAnswered && (
                      <span className={`text-xs font-bold flex items-center space-x-1 ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        <span>{isCorrect ? 'Correct Evidence!' : 'Review Clue'}</span>
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-slate-100">{q.question}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt, optIdx) => {
                      let btnStyle = 'bg-slate-900 hover:bg-slate-800/80 text-slate-300 border-slate-800';
                      if (isAnswered) {
                        if (optIdx === q.correctIndex) {
                          btnStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-200 font-semibold ring-1 ring-emerald-500';
                        } else if (optIdx === selectedOption) {
                          btnStyle = 'bg-rose-950/80 border-rose-500 text-rose-200';
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelectAnswer(qIndex, optIdx)}
                          disabled={caseCompleted}
                          className={`p-3 rounded-xl border text-left text-xs transition-all ${btnStyle}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {showExplanations[qIndex] && (
                    <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-800/50 text-xs text-blue-200 leading-relaxed">
                      <strong>Detective Note:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submission and Verdict */}
          {isQuizPassed && !caseCompleted && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-950 border border-emerald-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h5 className="text-sm font-bold text-white">All Clues Verified! Ready to issue the scientific verdict?</h5>
                <p className="text-xs text-slate-400">Your mathematical analysis matches peer-reviewed satellite observations.</p>
              </div>
              <button
                onClick={handleCompleteCase}
                className="flex items-center space-x-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all uppercase tracking-wider"
              >
                <Award className="w-4 h-4" />
                <span>Issue Official Verdict</span>
              </button>
            </div>
          )}

          {/* Completed Case Badge & Certificate */}
          {caseCompleted && (
            <div className="p-6 rounded-2xl bg-slate-950 border-2 border-emerald-500/80 space-y-4 animate-scaleUp">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl bg-emerald-500 text-slate-950">
                  <Award className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-400 block font-mono">
                    NASA EARTH SCIENCE INVESTIGATION RESOLVED
                  </span>
                  <h4 className="text-lg font-black text-white">
                    Official Detective Certification: {selectedCase.title}
                  </h4>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs text-slate-200 leading-relaxed">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Statistical Significance:</span>
                  <SignificanceBadge stats={stats} />
                </div>
                <div>
                  <strong className="text-white block mb-1">Debrief Verdict:</strong>
                  {selectedCase.verdictDebrief}
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <strong className="text-white block mb-1">Planetary Consequence:</strong>
                  {selectedCase.realWorldImpact}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  onClick={handleResetCase}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-examine Case</span>
                </button>

                <div className="text-xs font-mono text-emerald-400 flex items-center space-x-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Dossier verified with NASA Earth Science Data Standards</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
