import { Check } from 'lucide-react';

export default function Stepper({ steps, currentStep, completedSteps, onStepClick }) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
        />
      </div>
      <div className="stepper">
        {steps.map((step, i) => {
          const isCompleted = completedSteps.includes(step.key);
          const isActive = step.key === currentStep;
          const isClickable = isCompleted || isActive || i <= currentIndex;
          return (
            <div
              key={step.key}
              className={`stepper-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isClickable ? 'clickable' : ''}`}
              onClick={() => isClickable && onStepClick?.(step.key)}
            >
              <div className="stepper-dot">{isCompleted ? <Check style={{ width: 14, height: 14 }} strokeWidth={2.5} aria-hidden="true" /> : i + 1}</div>
              <div className="stepper-label">{step.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
