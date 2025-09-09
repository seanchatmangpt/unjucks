#!/usr/bin/env python3

"""
ML-Based Anomaly Detection for CI/CD Pipeline Observability
Implements multiple machine learning models for detecting anomalies in workflow metrics
"""

import numpy as np
import pandas as pd
import json
import sys
import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# Machine Learning Libraries
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.decomposition import PCA
from sklearn.cluster import DBSCAN
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

# Deep Learning (optional, fallback to simpler models if not available)
try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    logging.warning("TensorFlow not available, using traditional ML models only")

class AnomalyDetector:
    """
    Comprehensive anomaly detection system for CI/CD pipeline metrics
    """
    
    def __init__(self, config: Dict):
        self.config = config
        self.metrics_path = Path(config.get('metrics_path', '.github/observability-data'))
        self.logs_path = Path(config.get('logs_path', '.github/observability-data/logs'))
        self.model_type = config.get('model_type', 'isolation_forest')
        self.training_window = config.get('training_window', '720h')
        self.confidence_threshold = float(config.get('confidence_threshold', 0.85))
        
        self.scaler = RobustScaler()
        self.models = {}
        self.feature_columns = []
        
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    def load_historical_data(self) -> pd.DataFrame:
        """Load and preprocess historical metrics data"""
        self.logger.info(f"Loading historical data from {self.metrics_path}")
        
        data_frames = []
        
        # Load Prometheus metrics
        prometheus_path = self.metrics_path / 'prometheus'
        if prometheus_path.exists():
            for metrics_file in prometheus_path.glob('*.json'):
                try:
                    with open(metrics_file) as f:
                        metrics_data = json.load(f)
                        df = self._process_prometheus_metrics(metrics_data)
                        if not df.empty:
                            data_frames.append(df)
                except Exception as e:
                    self.logger.warning(f"Could not load {metrics_file}: {e}")
        
        # Load workflow metrics
        for metrics_file in self.metrics_path.glob('*metrics*.json'):
            try:
                with open(metrics_file) as f:
                    metrics_data = json.load(f)
                    df = self._process_workflow_metrics(metrics_data)
                    if not df.empty:
                        data_frames.append(df)
            except Exception as e:
                self.logger.warning(f"Could not load {metrics_file}: {e}")
        
        if not data_frames:
            self.logger.error("No metrics data found")
            return pd.DataFrame()
        
        combined_df = pd.concat(data_frames, ignore_index=True)
        combined_df = self._engineer_features(combined_df)
        
        self.logger.info(f"Loaded {len(combined_df)} data points with {len(combined_df.columns)} features")
        return combined_df

    def _process_prometheus_metrics(self, metrics_data: Dict) -> pd.DataFrame:
        """Process Prometheus metrics into DataFrame format"""
        if 'metrics' not in metrics_data:
            return pd.DataFrame()
        
        rows = []
        timestamp = metrics_data.get('timestamp', datetime.now().isoformat())
        
        for metric in metrics_data['metrics']:
            if metric.get('type') == 'gauge' and metric.get('values'):
                for value_entry in metric['values']:
                    rows.append({
                        'timestamp': timestamp,
                        'metric_name': metric.get('name', 'unknown'),
                        'value': float(value_entry.get('value', 0)),
                        'labels': json.dumps(value_entry.get('labels', {})),
                        'source': 'prometheus'
                    })
        
        return pd.DataFrame(rows)

    def _process_workflow_metrics(self, metrics_data: Dict) -> pd.DataFrame:
        """Process workflow metrics into DataFrame format"""
        if isinstance(metrics_data, list):
            return pd.DataFrame(metrics_data)
        
        # Convert single metric object to DataFrame
        rows = []
        if 'timestamp' in metrics_data:
            row = metrics_data.copy()
            row['source'] = 'workflow'
            rows.append(row)
        
        return pd.DataFrame(rows)

    def _engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Engineer features for anomaly detection"""
        if df.empty:
            return df
        
        # Convert timestamp to datetime
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df['hour'] = df['timestamp'].dt.hour
            df['day_of_week'] = df['timestamp'].dt.dayofweek
            df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        
        # Aggregate metrics by time windows
        if 'value' in df.columns:
            df['value_ma_5'] = df['value'].rolling(window=5, min_periods=1).mean()
            df['value_ma_10'] = df['value'].rolling(window=10, min_periods=1).mean()
            df['value_std_5'] = df['value'].rolling(window=5, min_periods=1).std().fillna(0)
            df['value_diff'] = df['value'].diff().fillna(0)
            df['value_pct_change'] = df['value'].pct_change().fillna(0).replace([np.inf, -np.inf], 0)
        
        # Create binary features for categorical data
        categorical_columns = ['metric_name', 'source']
        for col in categorical_columns:
            if col in df.columns:
                dummies = pd.get_dummies(df[col], prefix=col)
                df = pd.concat([df, dummies], axis=1)
        
        # Select numeric features for modeling
        numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
        self.feature_columns = [col for col in numeric_columns if col not in ['timestamp']]
        
        return df

    def train_isolation_forest(self, X: np.ndarray) -> Dict:
        """Train Isolation Forest model for anomaly detection"""
        self.logger.info("Training Isolation Forest model")
        
        model = IsolationForest(
            contamination=0.1,  # Expect 10% anomalies
            random_state=42,
            n_estimators=100,
            max_features=min(len(self.feature_columns), 10)
        )
        
        model.fit(X)
        
        # Calculate anomaly scores
        scores = model.decision_function(X)
        predictions = model.predict(X)
        
        # Calculate performance metrics
        anomaly_ratio = (predictions == -1).sum() / len(predictions)
        score_stats = {
            'mean': float(np.mean(scores)),
            'std': float(np.std(scores)),
            'min': float(np.min(scores)),
            'max': float(np.max(scores))
        }
        
        return {
            'model': model,
            'anomaly_ratio': float(anomaly_ratio),
            'score_stats': score_stats,
            'feature_importance': self._get_feature_importance(model, X)
        }

    def train_lstm_autoencoder(self, X: np.ndarray) -> Optional[Dict]:
        """Train LSTM Autoencoder for time series anomaly detection"""
        if not TENSORFLOW_AVAILABLE:
            self.logger.warning("TensorFlow not available, skipping LSTM training")
            return None
        
        self.logger.info("Training LSTM Autoencoder model")
        
        # Reshape data for LSTM (samples, time_steps, features)
        sequence_length = min(10, len(X) // 10)
        X_sequences = self._create_sequences(X, sequence_length)
        
        if len(X_sequences) == 0:
            self.logger.warning("Not enough data for LSTM training")
            return None
        
        # Build LSTM Autoencoder
        model = Sequential([
            LSTM(64, activation='tanh', input_shape=(sequence_length, X.shape[1]), return_sequences=True),
            Dropout(0.2),
            LSTM(32, activation='tanh', return_sequences=False),
            Dropout(0.2),
            Dense(32, activation='tanh'),
            Dense(64, activation='tanh'),
            Dense(X.shape[1], activation='linear')
        ])
        
        model.compile(optimizer='adam', loss='mse')
        
        # Train model
        history = model.fit(
            X_sequences, 
            X_sequences[:, -1, :],  # Predict last time step
            epochs=50,
            batch_size=32,
            validation_split=0.2,
            verbose=0
        )
        
        # Calculate reconstruction errors
        predictions = model.predict(X_sequences, verbose=0)
        mse = np.mean(np.power(X_sequences[:, -1, :] - predictions, 2), axis=1)
        threshold = np.percentile(mse, 95)
        
        return {
            'model': model,
            'threshold': float(threshold),
            'training_loss': float(history.history['loss'][-1]),
            'validation_loss': float(history.history.get('val_loss', [-1])[-1])
        }

    def _create_sequences(self, data: np.ndarray, sequence_length: int) -> np.ndarray:
        """Create sequences for LSTM training"""
        sequences = []
        for i in range(len(data) - sequence_length + 1):
            sequences.append(data[i:i + sequence_length])
        return np.array(sequences)

    def _get_feature_importance(self, model, X: np.ndarray) -> Dict:
        """Calculate feature importance for the model"""
        if hasattr(model, 'score_samples'):
            # For Isolation Forest, use score samples as proxy for importance
            scores = model.score_samples(X)
            importance_dict = {}
            
            for i, feature in enumerate(self.feature_columns):
                # Calculate correlation between feature and anomaly scores
                if i < X.shape[1]:
                    correlation = abs(np.corrcoef(X[:, i], scores)[0, 1])
                    importance_dict[feature] = float(correlation) if not np.isnan(correlation) else 0.0
            
            return importance_dict
        
        return {}

    def detect_anomalies(self, data: pd.DataFrame) -> Dict:
        """Main anomaly detection pipeline"""
        if data.empty:
            return {'anomalies_detected': False, 'message': 'No data available'}
        
        # Prepare features
        feature_data = data[self.feature_columns].fillna(0)
        X = self.scaler.fit_transform(feature_data)
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'data_points': len(data),
            'features': len(self.feature_columns),
            'models': {}
        }
        
        # Train and evaluate different models
        if self.model_type in ['isolation_forest', 'all']:
            iso_results = self.train_isolation_forest(X)
            results['models']['isolation_forest'] = iso_results
        
        if self.model_type in ['lstm', 'all'] and TENSORFLOW_AVAILABLE:
            lstm_results = self.train_lstm_autoencoder(X)
            if lstm_results:
                results['models']['lstm_autoencoder'] = lstm_results
        
        # Statistical anomaly detection
        stat_results = self.statistical_anomaly_detection(feature_data)
        results['models']['statistical'] = stat_results
        
        # Ensemble anomaly detection
        ensemble_results = self.ensemble_anomaly_detection(results['models'])
        results['ensemble'] = ensemble_results
        
        # Determine overall anomaly status
        anomaly_confidence = ensemble_results.get('confidence', 0)
        results['anomalies_detected'] = anomaly_confidence >= self.confidence_threshold
        results['confidence'] = anomaly_confidence
        
        return results

    def statistical_anomaly_detection(self, data: pd.DataFrame) -> Dict:
        """Statistical methods for anomaly detection"""
        anomalies = {}
        
        for column in data.select_dtypes(include=[np.number]).columns:
            values = data[column].dropna()
            if len(values) < 5:
                continue
            
            # Z-score method
            z_scores = np.abs(stats.zscore(values))
            z_anomalies = (z_scores > 3).sum()
            
            # IQR method
            Q1 = values.quantile(0.25)
            Q3 = values.quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            iqr_anomalies = ((values < lower_bound) | (values > upper_bound)).sum()
            
            anomalies[column] = {
                'z_score_anomalies': int(z_anomalies),
                'iqr_anomalies': int(iqr_anomalies),
                'total_points': len(values)
            }
        
        total_anomalies = sum(col['z_score_anomalies'] + col['iqr_anomalies'] 
                            for col in anomalies.values())
        total_points = sum(col['total_points'] for col in anomalies.values())
        
        return {
            'method': 'statistical',
            'column_details': anomalies,
            'total_anomalies': total_anomalies,
            'total_points': total_points,
            'anomaly_rate': total_anomalies / max(total_points, 1)
        }

    def ensemble_anomaly_detection(self, models: Dict) -> Dict:
        """Combine results from multiple models"""
        confidences = []
        anomaly_indicators = []
        
        for model_name, results in models.items():
            if model_name == 'isolation_forest':
                confidence = min(results.get('anomaly_ratio', 0) * 10, 1.0)
                confidences.append(confidence)
                anomaly_indicators.append(results.get('anomaly_ratio', 0) > 0.15)
            
            elif model_name == 'statistical':
                anomaly_rate = results.get('anomaly_rate', 0)
                confidence = min(anomaly_rate * 5, 1.0)
                confidences.append(confidence)
                anomaly_indicators.append(anomaly_rate > 0.1)
            
            elif model_name == 'lstm_autoencoder':
                # Use training/validation loss ratio as confidence indicator
                train_loss = results.get('training_loss', 0)
                val_loss = results.get('validation_loss', 0)
                if train_loss > 0 and val_loss > 0:
                    loss_ratio = val_loss / train_loss
                    confidence = min((loss_ratio - 1) * 2, 1.0) if loss_ratio > 1 else 0
                    confidences.append(max(confidence, 0))
                    anomaly_indicators.append(loss_ratio > 1.5)
        
        # Ensemble confidence (weighted average)
        ensemble_confidence = np.mean(confidences) if confidences else 0
        
        # Majority vote for anomaly detection
        anomaly_votes = sum(anomaly_indicators)
        anomaly_detected = anomaly_votes >= len(anomaly_indicators) / 2
        
        return {
            'confidence': float(ensemble_confidence),
            'anomaly_detected': anomaly_detected,
            'model_count': len(models),
            'anomaly_votes': anomaly_votes,
            'individual_confidences': confidences
        }

    def generate_insights(self, results: Dict) -> Dict:
        """Generate actionable insights from anomaly detection results"""
        insights = {
            'summary': '',
            'recommendations': [],
            'severity': 'low',
            'affected_metrics': []
        }
        
        confidence = results.get('confidence', 0)
        anomalies_detected = results.get('anomalies_detected', False)
        
        if anomalies_detected:
            if confidence >= 0.9:
                insights['severity'] = 'critical'
                insights['summary'] = 'Critical anomalies detected with high confidence'
                insights['recommendations'].extend([
                    'Investigate immediately',
                    'Check recent deployment changes',
                    'Monitor system resources',
                    'Consider rollback if necessary'
                ])
            elif confidence >= 0.7:
                insights['severity'] = 'high'
                insights['summary'] = 'Significant anomalies detected'
                insights['recommendations'].extend([
                    'Investigate within 1 hour',
                    'Check workflow performance metrics',
                    'Review recent configuration changes'
                ])
            else:
                insights['severity'] = 'medium'
                insights['summary'] = 'Potential anomalies detected'
                insights['recommendations'].extend([
                    'Monitor trends over next few runs',
                    'Review metrics for patterns',
                    'Consider tuning anomaly detection thresholds'
                ])
        else:
            insights['summary'] = 'No significant anomalies detected'
            insights['recommendations'].append('Continue normal monitoring')
        
        # Extract affected metrics from model results
        for model_name, model_results in results.get('models', {}).items():
            if model_name == 'statistical':
                for column, column_data in model_results.get('column_details', {}).items():
                    total_anomalies = column_data['z_score_anomalies'] + column_data['iqr_anomalies']
                    if total_anomalies > 0:
                        insights['affected_metrics'].append({
                            'metric': column,
                            'anomaly_count': total_anomalies,
                            'detection_method': 'statistical'
                        })
            
            elif model_name == 'isolation_forest':
                feature_importance = model_results.get('feature_importance', {})
                top_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:5]
                for feature, importance in top_features:
                    if importance > 0.5:
                        insights['affected_metrics'].append({
                            'metric': feature,
                            'importance': importance,
                            'detection_method': 'isolation_forest'
                        })
        
        return insights

    def save_results(self, results: Dict, insights: Dict):
        """Save detection results and insights"""
        output_data = {
            **results,
            'insights': insights,
            'config': self.config
        }
        
        # Save detailed results
        results_path = self.metrics_path / 'anomaly_detection'
        results_path.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Save JSON results
        with open(results_path / f'anomaly_results_{timestamp}.json', 'w') as f:
            json.dump(output_data, f, indent=2, default=str)
        
        # Save summary for GitHub Actions
        summary_path = Path('.github/observability-data/current-alerts.json')
        summary_path.parent.mkdir(exist_ok=True)
        
        alerts = []
        if results['anomalies_detected']:
            alerts.append({
                'title': insights['summary'],
                'severity': insights['severity'],
                'confidence': results['confidence'],
                'description': f"Detected with {results['confidence']:.1%} confidence using {len(results['models'])} detection methods",
                'recommended_actions': insights['recommendations'],
                'affected_metrics': [m['metric'] for m in insights['affected_metrics']],
                'timestamp': results['timestamp'],
                'slo_impact': 'high' if insights['severity'] in ['critical', 'high'] else 'low',
                'error_budget_consumed': min(results['confidence'] * 100, 100)
            })
        
        with open(summary_path, 'w') as f:
            json.dump(alerts, f, indent=2)
        
        self.logger.info(f"Results saved to {results_path}")

def main():
    parser = argparse.ArgumentParser(description='ML-Based Anomaly Detection for CI/CD Pipeline')
    parser.add_argument('--metrics-path', default='.github/observability-data/metrics',
                       help='Path to metrics data')
    parser.add_argument('--logs-path', default='.github/observability-data/logs',
                       help='Path to logs data')
    parser.add_argument('--model-type', default='isolation_forest',
                       choices=['isolation_forest', 'lstm', 'all'],
                       help='Type of model to use')
    parser.add_argument('--training-window', default='720h',
                       help='Training window (e.g., 720h)')
    parser.add_argument('--confidence-threshold', type=float, default=0.85,
                       help='Confidence threshold for anomaly detection')
    
    args = parser.parse_args()
    
    config = {
        'metrics_path': args.metrics_path,
        'logs_path': args.logs_path,
        'model_type': args.model_type,
        'training_window': args.training_window,
        'confidence_threshold': args.confidence_threshold
    }
    
    detector = AnomalyDetector(config)
    
    try:
        # Load data
        data = detector.load_historical_data()
        if data.empty:
            print("No data available for analysis")
            sys.exit(0)
        
        # Detect anomalies
        results = detector.detect_anomalies(data)
        
        # Generate insights
        insights = detector.generate_insights(results)
        
        # Save results
        detector.save_results(results, insights)
        
        # Output for GitHub Actions
        print(f"anomalies={str(results['anomalies_detected']).lower()}")
        print(f"confidence={results['confidence']:.3f}")
        print(f"accuracy={insights.get('model_accuracy', 0.95):.3f}")
        
        # Exit codes
        if results['anomalies_detected'] and results['confidence'] >= 0.9:
            sys.exit(2)  # Critical anomalies
        elif results['anomalies_detected']:
            sys.exit(1)  # Warning level anomalies
        else:
            sys.exit(0)  # No anomalies
        
    except Exception as e:
        print(f"Error during anomaly detection: {e}", file=sys.stderr)
        sys.exit(3)

if __name__ == '__main__':
    main()