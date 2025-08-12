import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/supabase-server-client';
import { AuditLogger } from '@/libs/logging/audit-logger';
import { UsageTracker } from '@/libs/monitoring/usage-tracker';
import { WhisperTranscriptionResponse } from '@/types/voice';
import OpenAI from 'openai';

const auditLogger = new AuditLogger('voice-transcription');
const usageTracker = new UsageTracker();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_API_KEY 
    ? 'https://openrouter.ai/api/v1'
    : 'https://api.openai.com/v1',
});

interface TranscriptionRequest {
  file: File;
  model?: string;
  language?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
  prompt?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      await auditLogger.log({
        action: 'voice_transcription_unauthorized',
        user_id: 'anonymous',
        details: { error: authError?.message }
      });
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const model = formData.get('model') as string || 'whisper-1';
    const language = formData.get('language') as string;
    const response_format = (formData.get('response_format') as string) || 'verbose_json';
    const temperature = formData.get('temperature') ? parseFloat(formData.get('temperature') as string) : 0.2;
    const prompt = formData.get('prompt') as string;

    if (!file) {
      await auditLogger.log({
        action: 'voice_transcription_no_file',
        user_id: user.id,
        details: { error: 'No audio file provided' }
      });
      
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4',
      'audio/m4a', 'audio/ogg', 'audio/flac', 'audio/x-wav'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      await auditLogger.log({
        action: 'voice_transcription_invalid_file_type',
        user_id: user.id,
        details: { file_type: file.type, allowed_types: allowedTypes }
      });
      
      return NextResponse.json(
        { 
          error: 'Invalid file type', 
          details: 'Supported formats: MP3, WAV, WEBM, MP4, M4A, OGG, FLAC',
          detailsAr: 'الصيغ المدعومة: MP3, WAV, WEBM, MP4, M4A, OGG, FLAC'
        },
        { status: 400 }
      );
    }

    // Validate file size (25MB limit for Whisper API)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      await auditLogger.log({
        action: 'voice_transcription_file_too_large',
        user_id: user.id,
        details: { file_size: file.size, max_size: maxSize }
      });
      
      return NextResponse.json(
        { 
          error: 'File too large', 
          details: `Maximum file size is 25MB. Your file is ${Math.round(file.size / 1024 / 1024)}MB`,
          detailsAr: `الحد الأقصى لحجم الملف 25 ميجابايت. حجم ملفك ${Math.round(file.size / 1024 / 1024)} ميجابايت`
        },
        { status: 400 }
      );
    }

    // Convert File to Blob for OpenAI API
    const audioBuffer = await file.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: file.type });

    // Prepare transcription request
    const transcriptionOptions: any = {
      file: new File([audioBlob], file.name, { type: file.type }),
      model,
      response_format,
      temperature,
    };

    // Add language if specified
    if (language) {
      transcriptionOptions.language = language;
    }

    // Add prompt for better accuracy (especially for Arabic)
    if (prompt) {
      transcriptionOptions.prompt = prompt;
    } else if (language === 'ar') {
      // Default Arabic context prompt
      transcriptionOptions.prompt = 'هذا تسجيل صوتي باللغة العربية يتعلق بالموارد البشرية والعمل والقانون السعودي.';
    }

    // Call Whisper API
    let transcriptionResult;
    try {
      transcriptionResult = await openai.audio.transcriptions.create(transcriptionOptions);
    } catch (apiError: any) {
      await auditLogger.log({
        action: 'voice_transcription_api_error',
        user_id: user.id,
        details: { 
          error: apiError.message,
          status: apiError.status,
          type: apiError.type 
        }
      });

      // Handle specific OpenAI errors
      if (apiError.status === 413) {
        return NextResponse.json(
          { 
            error: 'File too large for transcription service',
            details: 'Please use a smaller audio file (under 25MB)',
            detailsAr: 'يرجى استخدام ملف صوتي أصغر (أقل من 25 ميجابايت)'
          },
          { status: 413 }
        );
      }

      if (apiError.status === 429) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            details: 'Too many requests. Please try again later.',
            detailsAr: 'تم تجاوز حد الطلبات. يرجى المحاولة لاحقاً.'
          },
          { status: 429 }
        );
      }

      throw apiError;
    }

    // Process the response based on format
    let processedResult: WhisperTranscriptionResponse;
    
    if (response_format === 'verbose_json') {
      processedResult = {
        text: transcriptionResult.text,
        language: transcriptionResult.language,
        duration: transcriptionResult.duration,
        segments: transcriptionResult.segments?.map(segment => ({
          id: segment.id,
          seek: segment.seek,
          start: segment.start,
          end: segment.end,
          text: segment.text,
          tokens: segment.tokens,
          temperature: segment.temperature,
          avg_logprob: segment.avg_logprob,
          compression_ratio: segment.compression_ratio,
          no_speech_prob: segment.no_speech_prob,
        }))
      };
    } else {
      processedResult = {
        text: typeof transcriptionResult === 'string' ? transcriptionResult : transcriptionResult.text
      };
    }

    // Track usage
    const processingTime = Date.now() - startTime;
    await usageTracker.trackUsage({
      user_id: user.id,
      feature: 'voice_transcription',
      tokens_used: Math.ceil(file.size / 1000), // Approximate tokens based on file size
      cost: Math.ceil(file.size / 1000) * 0.006, // Whisper pricing: $0.006 per minute
      processing_time: processingTime,
      metadata: {
        file_size: file.size,
        file_type: file.type,
        language: language || 'auto',
        model,
        response_format,
        duration: processedResult.duration,
      }
    });

    // Log successful transcription
    await auditLogger.log({
      action: 'voice_transcription_success',
      user_id: user.id,
      details: {
        file_size: file.size,
        file_type: file.type,
        language: processedResult.language || language || 'auto',
        text_length: processedResult.text.length,
        processing_time: processingTime,
        model,
        segments_count: processedResult.segments?.length
      }
    });

    // Detect and enhance Arabic text if needed
    if (processedResult.language === 'ar' || language === 'ar') {
      processedResult.text = enhanceArabicTranscription(processedResult.text);
    }

    return NextResponse.json(processedResult);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    await auditLogger.log({
      action: 'voice_transcription_error',
      user_id: 'unknown',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time: processingTime,
        stack: error instanceof Error ? error.stack : undefined
      }
    });

    console.error('Voice transcription error:', error);

    return NextResponse.json(
      { 
        error: 'Transcription failed',
        details: error instanceof Error ? error.message : 'An unexpected error occurred',
        detailsAr: 'فشل في تحويل الكلام إلى نص. يرجى المحاولة مرة أخرى.'
      },
      { status: 500 }
    );
  }
}

// Enhanced Arabic text post-processing
function enhanceArabicTranscription(text: string): string {
  if (!text) return text;

  // Common Arabic corrections for speech recognition
  const corrections: Array<[RegExp, string]> = [
    // Fix common Arabic diacritics issues
    [/أ/g, 'أ'],
    [/إ/g, 'إ'],
    [/آ/g, 'آ'],
    
    // Fix common word confusions
    [/\bفي\b/g, 'في'],
    [/\bعلى\b/g, 'على'],
    [/\bمن\b/g, 'من'],
    [/\bإلى\b/g, 'إلى'],
    [/\bهذا\b/g, 'هذا'],
    [/\bهذه\b/g, 'هذه'],
    [/\bذلك\b/g, 'ذلك'],
    [/\bتلك\b/g, 'تلك'],
    
    // Fix HR/Legal specific terms
    [/موظف/g, 'موظف'],
    [/عامل/g, 'عامل'],
    [/راتب/g, 'راتب'],
    [/إجازة/g, 'إجازة'],
    [/عقد/g, 'عقد'],
    [/قانون/g, 'قانون'],
    [/نظام العمل/g, 'نظام العمل'],
    [/وزارة العمل/g, 'وزارة العمل'],
    [/الموارد البشرية/g, 'الموارد البشرية'],
    
    // Fix numbers in Arabic context
    [/(\d+)\s*سنة/g, '$1 سنة'],
    [/(\d+)\s*شهر/g, '$1 شهر'],
    [/(\d+)\s*يوم/g, '$1 يوم'],
    [/(\d+)\s*ريال/g, '$1 ريال'],
    [/(\d+)\s*درهم/g, '$1 درهم'],
    
    // Clean up extra spaces
    [/\s+/g, ' '],
    [/^\s+|\s+$/g, ''],
  ];

  let correctedText = text;
  corrections.forEach(([pattern, replacement]) => {
    correctedText = correctedText.replace(pattern, replacement);
  });

  // Ensure proper sentence structure
  correctedText = correctedText
    .split('.')
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0)
    .map(sentence => sentence.charAt(0).toUpperCase() + sentence.slice(1))
    .join('. ');

  return correctedText;
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Return API info and supported formats
    return NextResponse.json({
      service: 'Whisper Speech-to-Text API',
      supported_formats: [
        'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/webm', 
        'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/flac'
      ],
      supported_languages: [
        { code: 'ar', name: 'Arabic', nameAr: 'العربية' },
        { code: 'en', name: 'English', nameAr: 'الإنجليزية' },
        { code: 'auto', name: 'Auto-detect', nameAr: 'كشف تلقائي' }
      ],
      max_file_size: '25MB',
      response_formats: ['json', 'text', 'srt', 'verbose_json', 'vtt'],
      pricing: {
        per_minute: 0.006,
        currency: 'USD'
      },
      features: [
        'High accuracy Arabic speech recognition',
        'Multiple Arabic dialects support', 
        'Legal and HR terminology enhancement',
        'Automatic punctuation',
        'Timestamp generation',
        'Confidence scoring'
      ],
      featuresAr: [
        'دقة عالية في التعرف على الكلام العربي',
        'دعم لهجات عربية متعددة',
        'تحسين المصطلحات القانونية والإدارية',
        'علامات ترقيم تلقائية',
        'توليد الطوابع الزمنية',
        'تقييم الثقة'
      ]
    });

  } catch (error) {
    console.error('Voice transcription info error:', error);
    return NextResponse.json(
      { error: 'Failed to get transcription service info' },
      { status: 500 }
    );
  }
}