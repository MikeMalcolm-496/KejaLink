/**
 * useForm: form state, field errors from the server, and submitting.
 *
 *   const form = useForm({ email: '' });
 *   <input {...form.bind('email')} />
 *   form.submit(async (values) => api.post('/x', values))
 *
 * Errors returned by the API (422 with fields) are shown next to each input.
 */
import { useState } from 'react';

export default function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);       // form-level error text
  const [dirty, setDirty] = useState(false);

  const set = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setDirty(true);
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
    if (message) setMessage(null);            // the user is fixing things: hide the form-level message
  };

  const bind = (name, type = 'text') => {
    if (type === 'checkbox') {
      return { name, id: name, checked: Boolean(values[name]), onChange: (e) => set(name, e.target.checked) };
    }
    return {
      name, id: name, value: values[name] ?? '',
      onChange: (e) => set(name, e.target.value),
      'aria-invalid': errors[name] ? 'true' : undefined,
      'aria-describedby': errors[name] ? `${name}-error` : undefined,
    };
  };

  const submit = async (action, { validate } = {}) => {
    setMessage(null);
    if (validate) {
      const clientErrors = validate(values);
      if (Object.keys(clientErrors).length) {
        setErrors(clientErrors);
        setMessage('Please correct the highlighted fields.');
        const first = document.getElementById(Object.keys(clientErrors)[0]);
        if (first) first.focus();
        return undefined;
      }
    }
    setSubmitting(true);
    try {
      const result = await action(values);
      setErrors({});
      setDirty(false);
      return result;
    } catch (err) {
      setErrors(err.fields || {});
      setMessage(err.message);
      const firstField = Object.keys(err.fields || {}).find((k) => document.getElementById(k));
      if (firstField) document.getElementById(firstField).focus();
      return undefined;
    } finally {
      setSubmitting(false);
    }
  };

  return { values, setValues, set, bind, errors, setErrors, submit, submitting, message, setMessage, dirty };
}
