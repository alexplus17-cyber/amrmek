
import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import { Quiz, QuizQuestion } from '../types';
import { apiService } from '../services/apiService';
import Spinner from '../components/Spinner';

const STEPS = {
    PERSONAL: 1,
    DOCUMENTS: 2,
    QUIZ: 3,
    SUBMIT: 4,
};

const PersonalDetailsStep: React.FC<{ onNext: () => void }> = ({ onNext }) => (
    <div className="space-y-4">
        <h3 className="text-lg font-medium">Personal Information</h3>
        <Input id="fullName" label="Full Name" type="text" required />
        <Input id="dob" label="Date of Birth" type="date" required />
        <Input id="address" label="Full Address" type="text" required />
        <Button onClick={onNext}>Next</Button>
    </div>
);

const DocumentUploadStep: React.FC<{ onNext: () => void }> = ({ onNext }) => {
    const [idFile, setIdFile] = useState<File | null>(null);
    const [addressFile, setAddressFile] = useState<File | null>(null);
    const [idPreview, setIdPreview] = useState<string | null>(null);
    const [addressPreview, setAddressPreview] = useState<string | null>(null);

    useEffect(() => {
        // Cleanup object URLs to avoid memory leaks
        return () => {
            if (idPreview) URL.revokeObjectURL(idPreview);
            if (addressPreview) URL.revokeObjectURL(addressPreview);
        };
    }, [idPreview, addressPreview]);

    const handleFileChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        setFile: React.Dispatch<React.SetStateAction<File | null>>,
        currentPreview: string | null,
        setPreview: React.Dispatch<React.SetStateAction<string | null>>
    ) => {
        const file = e.target.files ? e.target.files[0] : null;
        setFile(file);
        
        if (currentPreview) {
            URL.revokeObjectURL(currentPreview);
        }

        if (file && file.type.startsWith('image/')) {
            const previewUrl = URL.createObjectURL(file);
            setPreview(previewUrl);
        } else {
            setPreview(null);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Upload Documents</h3>
            <div>
                <label htmlFor="idFile" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
                    ID / Passport
                </label>
                <input 
                    id="idFile" 
                    type="file" 
                    onChange={(e) => handleFileChange(e, setIdFile, idPreview, setIdPreview)} 
                    className="mt-1 block w-full text-sm text-secondary-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                {idPreview ? (
                    <div className="mt-2">
                        <img src={idPreview} alt="ID preview" className="max-h-32 rounded-md border border-secondary-200 dark:border-secondary-700" />
                    </div>
                ) : idFile && (
                    <p className="text-xs mt-1 text-secondary-600 dark:text-secondary-400">{idFile.name}</p>
                )}
            </div>
             <div>
                <label htmlFor="addressFile" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
                    Proof of Address
                </label>
                <input 
                    id="addressFile" 
                    type="file" 
                    onChange={(e) => handleFileChange(e, setAddressFile, addressPreview, setAddressPreview)} 
                    className="mt-1 block w-full text-sm text-secondary-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                {addressPreview ? (
                     <div className="mt-2">
                        <img src={addressPreview} alt="Proof of address preview" className="max-h-32 rounded-md border border-secondary-200 dark:border-secondary-700" />
                    </div>
                ) : addressFile && (
                    <p className="text-xs mt-1 text-secondary-600 dark:text-secondary-400">{addressFile.name}</p>
                )}
            </div>
            <Button onClick={onNext}>Next</Button>
        </div>
    );
};

const QuizStep: React.FC<{ onNext: () => void }> = ({ onNext }) => {
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [answers, setAnswers] = useState<{[key: number]: string}>({});

    React.useEffect(() => {
        apiService.getQuiz().then(setQuiz);
    }, []);

    const handleAnswer = (questionId: number, answer: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    if (!quiz) return <Spinner />;

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-medium">{quiz.title}</h3>
            {quiz.questions.map(q => (
                <div key={q.id}>
                    <p className="font-medium">{q.id}. {q.question}</p>
                    <div className="mt-2 space-y-2">
                        {q.options.map(option => (
                            <label key={option} className="flex items-center">
                                <input type="radio" name={`question-${q.id}`} value={option} onChange={() => handleAnswer(q.id, option)} className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-secondary-300"/>
                                <span className="ml-3 text-sm">{option}</span>
                            </label>
                        ))}
                    </div>
                </div>
            ))}
            <Button onClick={onNext} disabled={Object.keys(answers).length < quiz.questions.length}>Next</Button>
        </div>
    );
};

const SubmitStep: React.FC<{ onSubmit: () => void, isLoading: boolean }> = ({ onSubmit, isLoading }) => (
    <div className="text-center">
        <h3 className="text-lg font-medium">Ready to Submit?</h3>
        <p className="my-4">Please review your information before submitting. You cannot edit your application after this point.</p>
        <Button onClick={onSubmit} isLoading={isLoading}>Submit Application</Button>
    </div>
);


const ApplicationForm: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [step, setStep] = useState(STEPS.PERSONAL);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        setIsLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsLoading(false);
        alert("Application submitted successfully!");
        onComplete();
    };

    const renderStep = () => {
        switch (step) {
            case STEPS.PERSONAL:
                return <PersonalDetailsStep onNext={() => setStep(STEPS.DOCUMENTS)} />;
            case STEPS.DOCUMENTS:
                return <DocumentUploadStep onNext={() => setStep(STEPS.QUIZ)} />;
            case STEPS.QUIZ:
                return <QuizStep onNext={() => setStep(STEPS.SUBMIT)} />;
            case STEPS.SUBMIT:
                return <SubmitStep onSubmit={handleSubmit} isLoading={isLoading} />;
            default:
                return null;
        }
    };
    
    const stepNames = ['Personal Info', 'Documents', 'Quiz', 'Submit'];

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-secondary-900 dark:text-white">Investor Application</h1>
            
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    {stepNames.map((name, index) => (
                        <React.Fragment key={name}>
                             <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${index + 1 <= step ? 'bg-primary-600 text-white' : 'bg-secondary-200 dark:bg-secondary-700'}`}>
                                    {index + 1}
                                </div>
                                <p className="text-xs mt-1">{name}</p>
                             </div>
                             {index < stepNames.length - 1 && <div className={`flex-auto border-t-2 ${index + 1 < step ? 'border-primary-600' : 'border-secondary-200 dark:border-secondary-700'}`}></div>}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <Card>
                {renderStep()}
            </Card>
        </div>
    );
};

export default ApplicationForm;
