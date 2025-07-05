import React from 'react';
import { useParams } from 'react-router-dom';
import GymnastProgress from '../components/GymnastProgress';

const Progress = () => {
  const { gymnastId } = useParams();

  return (
    <div>
      <GymnastProgress gymnastId={gymnastId} />
    </div>
  );
};

export default Progress; 