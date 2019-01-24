<?php
namespace Mapbender\CoreBundle\Element\Type;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

/**
 * Class SketchAdminType
 * @package Mapbender\CoreBundle\Element\Type
 */
class SketchAdminType extends AbstractType
{
    /**
     * @return string
     */
    public function getName()
    {
        return 'sketch';
    }

    /**
     * @param OptionsResolver $resolver
     */
    public function configureOptions(OptionsResolver $resolver)
    {
        $resolver->setDefaults(array(
            'application' => null,
        ));
    }

    /**
     * @param FormBuilderInterface $builder
     * @param array $options
     */
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $types = array(
            "circle" => "circle",
        );
        $builder->add('tooltip', TextType::class, array('required' => false))
            ->add('target', TargetElementType::class,
                array(
                'element_class' => 'Mapbender\\CoreBundle\\Element\\Map',
                'application' => $options['application'],
                'property_path' => '[target]',
                'required' => false))
            ->add('defaultType', ChoiceType::class,
                array("required" => true,
                "choices" => $types))
            ->add('types', ChoiceType::class,
                array("required" => true,
                "choices" => $types,
                "multiple" => true));
    }
}
