
export const getColorClasses = (deviation: number) => {
  const absDeviation = Math.abs(deviation);
  
  // For positive deviations (increases)
  if (deviation > 0) {
    if (absDeviation <= 10) return 'bg-green-50 border-green-200 text-green-600';
    if (absDeviation <= 25) return 'bg-green-100 border-green-300 text-green-700';
    if (absDeviation <= 50) return 'bg-green-200 border-green-400 text-green-800';
    return 'bg-green-300 border-green-500 text-green-900'; // 50.1% or more
  } 
  // For negative deviations (decreases)
  else {
    if (absDeviation <= 10) return 'bg-orange-50 border-orange-200 text-orange-600';
    if (absDeviation <= 25) return 'bg-red-100 border-red-300 text-red-600';
    if (absDeviation <= 50) return 'bg-red-200 border-red-400 text-red-700';
    return 'bg-red-300 border-red-500 text-red-900'; // 50.1% or more
  }
};
